// Putting a beat under a recorded voice: where each one starts, a picture of the voice,
// and rendering the two together into one WAV file.
import { arrangementLength } from './pattern.js'
import { createMaster, playStep } from './playback.js'
import { stepSeconds, swingDelay } from './sequencer.js'
import { encodeWav } from './wav.js'

const TAIL_SECONDS = 1.5

// How far the beat may start before (negative) or after (positive) the voice, in seconds.
export const MIN_OFFSET = -2
export const MAX_OFFSET = 20

export const clampOffset = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, Math.round(n * 100) / 100)) : 0
}

// offset > 0: the beat comes in after the voice has started.
// offset < 0: the beat plays first and the voice comes in after it.
export function planStart(offset) {
  return { voiceDelay: Math.max(0, -offset), beatDelay: Math.max(0, offset) }
}

// Loudness of the voice over time, as `count` values from 0 to 1, for drawing the waveform.
export function peaksFromBuffer(buffer, count = 160) {
  const data = buffer.getChannelData(0)
  const size = Math.max(1, Math.floor(data.length / count))
  const peaks = []
  let loudest = 0
  for (let i = 0; i < count; i++) {
    let peak = 0
    const end = Math.min(data.length, (i + 1) * size)
    for (let j = i * size; j < end; j++) {
      const a = Math.abs(data[j])
      if (a > peak) peak = a
    }
    peaks.push(peak)
    if (peak > loudest) loudest = peak
  }
  return loudest > 0 ? peaks.map((p) => p / loudest) : peaks
}

export function decodeAudioBlob(ctx, blob) {
  return blob.arrayBuffer().then((bytes) => ctx.decodeAudioData(bytes))
}

// Schedules the beat on any audio context, repeating the whole arrangement until `until` (seconds).
export function scheduleBeatRange(ctx, dest, pattern, { start, until }) {
  const step = stepSeconds(pattern.bpm)
  const length = arrangementLength(pattern)
  for (let n = 0; ; n++) {
    const s = n % length
    const time = start + n * step + swingDelay(s, pattern.bpm, pattern.swing)
    if (time >= until) break
    playStep(ctx, dest, pattern, s, time)
  }
}

// Renders voice + looping beat faster than real time and returns a WAV file.
export async function renderMix({ voice, pattern, offset = 0, voiceGain = 1, beatGain = 0.6, sampleRate = 44100 }) {
  const OfflineCtx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext
  if (!OfflineCtx) throw new Error('Exporting audio is not supported in this browser.')

  const { voiceDelay, beatDelay } = planStart(offset)
  const voiceEnd = voiceDelay + voice.duration
  const length = Math.ceil((voiceEnd + TAIL_SECONDS) * sampleRate)
  const ctx = new OfflineCtx(2, length, sampleRate)
  const master = createMaster(ctx)

  const voiceBus = ctx.createGain()
  voiceBus.gain.setValueAtTime(voiceGain, 0)
  voiceBus.connect(master.input)
  const beatBus = ctx.createGain()
  beatBus.gain.setValueAtTime(beatGain, 0)
  beatBus.connect(master.input)

  const source = ctx.createBufferSource()
  source.buffer = voice
  source.connect(voiceBus)
  source.start(voiceDelay)

  scheduleBeatRange(ctx, beatBus, pattern, { start: beatDelay, until: voiceEnd })

  const rendered = await ctx.startRendering()
  const wav = encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], sampleRate)
  return new Blob([wav], { type: 'audio/wav' })
}
