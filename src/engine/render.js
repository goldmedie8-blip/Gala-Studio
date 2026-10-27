import { STEPS } from './pattern.js'
import { createMaster, playStep } from './playback.js'
import { stepSeconds, swingDelay } from './sequencer.js'
import { encodeWav } from './wav.js'

const TAIL_SECONDS = 1.5

// Plays the pattern into an offline audio context (faster than real time) and returns a WAV file.
export async function renderBeat(pattern, { bars = 4, sampleRate = 44100 } = {}) {
  const OfflineCtx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext
  if (!OfflineCtx) throw new Error('Exporting audio is not supported in this browser.')

  const barSeconds = STEPS * stepSeconds(pattern.bpm)
  const length = Math.ceil((barSeconds * bars + TAIL_SECONDS) * sampleRate)
  const ctx = new OfflineCtx(2, length, sampleRate)
  const master = createMaster(ctx)

  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < STEPS; step++) {
      const time = 0.01 + bar * barSeconds + step * stepSeconds(pattern.bpm) + swingDelay(step, pattern.bpm, pattern.swing)
      playStep(ctx, master.input, pattern, step, time)
    }
  }

  const rendered = await ctx.startRendering()
  const wav = encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], sampleRate)
  return new Blob([wav], { type: 'audio/wav' })
}
