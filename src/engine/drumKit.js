// "My sounds": any drum lane can play a recording of your own (an engoma hit, a clap, a shaker) instead of the
// built-in synthesised sound. Recordings come from the takes you already have on the device.
//
//   - Which recording each lane uses is remembered on the device (the "kit").
//   - A recording is decoded once, trimmed of silence at its start so the hit lands exactly on the beat, and
//     levelled so a quiet recording is not drowned out by the other drums.
//   - playDrum() asks getSample() first and falls back to the built-in sound, so a lane with no recording, a
//     deleted recording or a recording that cannot be read still plays.
//
// The decoded sounds are plain audio buffers, which any audio context can play, so they also work when a
// beat is rendered to a file.
import { getTake } from '../storage/takes.js'
import { DRUM_LANES } from './pattern.js'

const KIT_KEY = 'gala.kit.v1'
export const MAX_SAMPLE_SECONDS = 2 // a drum hit, not a whole song
const ANALYSE_SECONDS = 10 // only the start of a long recording is looked at
const TARGET_PEAK = 0.8
const MAX_GAIN = 4
const ONSET = 0.04 // the hit starts when the sound first reaches 4% of its loudest point
const PRE_ROLL = 0.002
const FADE = 0.02

const LANE_IDS = DRUM_LANES.map((lane) => lane.id)

// ---- which recording each lane uses ----

export function normalizeKit(raw) {
  const kit = {}
  if (!raw || typeof raw !== 'object') return kit
  for (const id of LANE_IDS) {
    if (typeof raw[id] === 'string' && raw[id]) kit[id] = raw[id]
  }
  return kit
}

export function readKit() {
  try {
    const saved = localStorage.getItem(KIT_KEY)
    return normalizeKit(saved ? JSON.parse(saved) : null)
  } catch {
    return {} // unreadable save
  }
}

function writeKit(kit) {
  try {
    localStorage.setItem(KIT_KEY, JSON.stringify(kit))
    return true
  } catch {
    return false // blocked storage: the sound still works for this visit
  }
}

// ---- turning a recording into a drum sound ----

// Where the hit starts, how long it lasts and how much to turn it up. Returns null for silence.
export function analyzeBuffer(buffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
  const length = Math.min(channels[0]?.length ?? 0, Math.floor(buffer.sampleRate * ANALYSE_SECONDS))
  let peak = 0
  for (const data of channels) {
    for (let i = 0; i < length; i++) {
      const value = Math.abs(data[i])
      if (value > peak) peak = value
    }
  }
  if (peak < 0.001) return null
  const threshold = peak * ONSET
  let first = 0
  search: for (let i = 0; i < length; i++) {
    for (const data of channels) {
      if (Math.abs(data[i]) >= threshold) {
        first = i
        break search
      }
    }
  }
  const offset = Math.max(0, first / buffer.sampleRate - PRE_ROLL)
  const duration = Math.min(MAX_SAMPLE_SECONDS, buffer.duration - offset)
  if (duration < 0.005) return null
  return { offset, duration, gain: Math.min(MAX_GAIN, TARGET_PEAK / peak) }
}

async function defaultDecode(bytes) {
  const Context = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext
  if (!Context) throw new Error('This browser cannot read recordings as sounds.')
  return new Context(1, 1, 44100).decodeAudioData(bytes)
}

// One recording ready to play, or null if it is gone or silent.
export async function loadSample(takeId, { fetchTake = getTake, decode = defaultDecode } = {}) {
  const take = await fetchTake(takeId)
  if (!take?.blob) return null
  const buffer = await decode(await take.blob.arrayBuffer())
  const info = analyzeBuffer(buffer)
  return info ? { takeId, buffer, ...info } : null
}

// ---- the sounds that are ready ----

const samples = new Map() // lane id -> sample

export const getSample = (laneId) => samples.get(laneId)
export const forgetSamples = () => samples.clear()

// Chooses a recording for a lane, or goes back to the built-in sound with takeId null.
// Throws a message for people if the recording cannot be used; nothing changes in that case.
export async function setLaneSound(laneId, takeId, deps) {
  if (!LANE_IDS.includes(laneId)) return
  const kit = readKit()
  if (!takeId) {
    delete kit[laneId]
    samples.delete(laneId)
    writeKit(kit)
    return
  }
  let sample = null
  try {
    sample = await loadSample(takeId, deps)
  } catch {
    // handled below with one message
  }
  if (!sample) throw new Error('That recording could not be used as a sound. Try a short recording of a single hit.')
  samples.set(laneId, sample)
  kit[laneId] = takeId
  writeKit(kit)
}

// Gets every remembered sound ready. A recording that is gone or unreadable is skipped, so that lane simply
// keeps its built-in sound. Returns how many were loaded.
export async function loadKit(deps) {
  let loaded = 0
  for (const [laneId, takeId] of Object.entries(readKit())) {
    try {
      const sample = await loadSample(takeId, deps)
      // Only if the choice has not changed while this was loading.
      if (sample && readKit()[laneId] === takeId) {
        samples.set(laneId, sample)
        loaded += 1
      }
    } catch {
      // keep the built-in sound
    }
  }
  return loaded
}

let preload = null
export function preloadKit(deps) {
  preload ??= loadKit(deps).catch(() => 0)
  return preload
}
export const resetPreloadForTests = () => {
  preload = null
}

// Start getting the kit ready as soon as the beat engine is loaded, so it is ready before the first Play.
// Nothing happens if no sounds were ever chosen.
if (typeof localStorage !== 'undefined') preloadKit()

// ---- playing one ----

export function playSample(ctx, dest, sample, time) {
  const source = ctx.createBufferSource()
  source.buffer = sample.buffer
  const amp = ctx.createGain()
  const end = time + sample.duration
  amp.gain.setValueAtTime(sample.gain, time)
  amp.gain.setValueAtTime(sample.gain, Math.max(time, end - FADE))
  amp.gain.linearRampToValueAtTime(0, end) // no click at the end
  source.connect(amp)
  amp.connect(dest)
  source.start(time, sample.offset, sample.duration)
}
