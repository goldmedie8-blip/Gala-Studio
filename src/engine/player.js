// Plays a timeline: schedules recordings and beats on the audio clock, loops, seeks, and renders the
// finished song to a WAV file. Like the beat sequencer it wakes up every 25 ms and schedules whatever
// falls in the next fraction of a second on the audio clock, so playback stays steady on a busy phone.
import { playClick } from './metronome.js'
import { createMixer } from './mixer.js'
import { STEPS } from './pattern.js'
import { playStep } from './playback.js'
import { stepSeconds, swingDelay } from './sequencer.js'
import { beatSeconds, timelineDuration } from './timeline.js'
import { encodeWav } from './wav.js'

const FADE_SECONDS = 0.004 // a tiny fade on every clip edge so cuts never click
const START_DELAY = 0.06
const END_PAD = 0.15
const TAIL_SECONDS = 2.5 // room for the reverb to die away in an exported song

// Schedules every recording clip that sounds between timeline times `from` and `to`.
// Timeline time `from` happens at audio time `ctxAt`. `keep` collects what was started so it can be stopped.
export function scheduleAudio(ctx, mixer, timeline, getBuffer, { from, to, ctxAt }, keep) {
  for (const track of timeline.tracks) {
    if (track.kind !== 'audio') continue
    const strip = mixer.strip(track.id)
    if (!strip) continue
    for (const clip of track.clips) {
      const buffer = getBuffer(clip.takeId)
      if (!buffer) continue
      const s = Math.max(clip.start, from)
      const e = Math.min(clip.start + clip.length, to)
      const length = e - s
      if (length < 0.002) continue
      const when = ctxAt + (s - from)
      const edge = Math.min(FADE_SECONDS, length / 2)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, when)
      gain.gain.linearRampToValueAtTime(clip.gain, when + edge)
      gain.gain.setValueAtTime(clip.gain, when + length - edge)
      gain.gain.linearRampToValueAtTime(0, when + length)
      source.connect(gain)
      gain.connect(strip.input)
      source.start(when, clip.offset + (s - clip.start), length)
      keep?.push({ source, gain })
    }
  }
}

// Schedules the beat steps (and optionally metronome clicks) that fall in [a, b) of timeline time.
// `destFor(track)` says where a beat track's sound goes.
export function scheduleBeats(ctx, mixer, timeline, { a, b, ctxAt, from, destFor, clicks = false }) {
  const bpm = timeline.bpm
  const step = stepSeconds(bpm)
  for (const track of timeline.tracks) {
    if (track.kind !== 'beat') continue
    const dest = destFor(track)
    if (!dest) continue
    for (const clip of track.clips) {
      const total = clip.bars * STEPS
      const view = { ...clip.pattern, bpm }
      // The first step at or after `a`. The same arithmetic decides every window, so no step is played twice.
      let n = Math.max(0, Math.floor((a - clip.start) / step) - 1)
      while (n < total && clip.start + n * step < a) n++
      for (; n < total; n++) {
        const u = clip.start + n * step
        if (u >= b) break
        playStep(ctx, dest, view, n, ctxAt + (u - from) + swingDelay(n, bpm, clip.pattern.swing))
      }
    }
  }
  if (clicks) {
    const beat = beatSeconds(bpm)
    let k = Math.max(0, Math.floor(a / beat) - 1)
    while (k * beat < a) k++
    for (; k * beat < b; k++) playClick(ctx, mixer.clickBus, ctxAt + (k * beat - from), k % 4 === 0)
  }
}

export class TimelinePlayer {
  constructor({ ctx, mixer, getTimeline, getBuffer, onEnd, lookahead = 0.25, interval = 25 }) {
    Object.assign(this, { ctx, mixer, getTimeline, getBuffer, onEnd, lookahead, interval })
    this.state = 'stopped' // stopped | playing | paused
    this.pos = 0
    this.passes = []
    this.sources = []
    this.gates = new Map()
    this.timer = null
    this.cursor = 0
  }

  // Where the playhead is, in seconds of timeline time.
  position() {
    if (this.state !== 'playing' || this.passes.length === 0) return this.pos
    const now = this.ctx.currentTime
    let pass = this.passes[0]
    for (const candidate of this.passes) if (candidate.ctxAt <= now) pass = candidate
    return Math.min(pass.to, Math.max(pass.from, pass.from + (now - pass.ctxAt)))
  }

  play(from = this.pos) {
    this.clear()
    const timeline = this.getTimeline()
    const start = Math.max(0, from)
    const { loop } = timeline
    const first = { from: start, to: loop.on && start < loop.end ? loop.end : Infinity, ctxAt: this.ctx.currentTime + START_DELAY }
    this.passes = [first]
    this.cursor = start
    this.state = 'playing'
    scheduleAudio(this.ctx, this.mixer, timeline, this.getBuffer, first, this.sources)
    this.timer = setInterval(() => this.tick(), this.interval)
    this.tick()
  }

  pause() {
    if (this.state !== 'playing') return
    this.pos = this.position()
    this.clear()
    this.state = 'paused'
  }

  stop() {
    this.clear()
    this.pos = 0
    this.state = 'stopped'
  }

  seek(time) {
    this.pos = Math.max(0, time)
    if (this.state === 'playing') this.play(this.pos)
  }

  // Called after the timeline is edited while it plays: carries on from the same place with the change.
  refresh() {
    if (this.state === 'playing') this.play(this.position())
  }

  dest(track) {
    let gate = this.gates.get(track.id)
    if (!gate) {
      const strip = this.mixer.strip(track.id)
      if (!strip) return null
      gate = this.ctx.createGain()
      gate.connect(strip.input)
      this.gates.set(track.id, gate)
    }
    return gate
  }

  tick() {
    const { ctx } = this
    const timeline = this.getTimeline()
    const now = ctx.currentTime
    let pass = this.passes[this.passes.length - 1]
    for (let guard = 0; guard < 8; guard++) {
      const limit = Math.min(pass.from + (now + this.lookahead - pass.ctxAt), pass.to)
      if (limit > this.cursor) {
        scheduleBeats(ctx, this.mixer, timeline, {
          a: this.cursor,
          b: limit,
          ctxAt: pass.ctxAt,
          from: pass.from,
          destFor: (track) => this.dest(track),
          clicks: timeline.metronome,
        })
        this.cursor = limit
      }
      if (this.cursor < pass.to || !timeline.loop.on) break
      // The end of the loop is close: queue the next time round so there is no gap.
      const next = { from: timeline.loop.start, to: timeline.loop.end, ctxAt: pass.ctxAt + (pass.to - pass.from) }
      this.passes.push(next)
      scheduleAudio(ctx, this.mixer, timeline, this.getBuffer, next, this.sources)
      this.cursor = next.from
      pass = next
    }
    while (this.passes.length > 1 && now >= this.passes[1].ctxAt) this.passes.shift()
    if (this.passes.length === 1 && pass.to === Infinity && this.position() >= timelineDuration(timeline) + END_PAD) {
      this.stop()
      this.onEnd?.()
    }
  }

  clear() {
    clearInterval(this.timer)
    this.timer = null
    const now = this.ctx.currentTime
    for (const { source, gain } of this.sources) {
      try {
        source.stop()
      } catch {
        // already finished
      }
      gain.disconnect()
    }
    this.sources = []
    // Beat sounds are scheduled a moment ahead. Closing their gates silences the ones not yet heard.
    for (const gate of this.gates.values()) {
      gate.gain.setValueAtTime(0, now)
      gate.disconnect()
    }
    this.gates.clear()
    this.passes = []
  }

  dispose() {
    this.clear()
    this.state = 'stopped'
  }
}

// Mixes the whole timeline faster than real time and returns a WAV file.
export async function renderTimeline(timeline, getBuffer, { sampleRate = 44100 } = {}) {
  const OfflineCtx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext
  if (!OfflineCtx) throw new Error('Exporting audio is not supported in this browser.')
  const duration = timelineDuration(timeline)
  if (duration <= 0) throw new Error('There is nothing to export yet. Add a recording or a beat first.')

  const ctx = new OfflineCtx(2, Math.ceil((duration + TAIL_SECONDS) * sampleRate), sampleRate)
  const mixer = createMixer(ctx)
  mixer.update(timeline)
  scheduleAudio(ctx, mixer, timeline, getBuffer, { from: 0, to: duration, ctxAt: 0 })
  scheduleBeats(ctx, mixer, timeline, { a: 0, b: duration, ctxAt: 0, from: 0, destFor: (track) => mixer.strip(track.id)?.input })
  const rendered = await ctx.startRendering()
  return new Blob([encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], sampleRate)], { type: 'audio/wav' })
}

