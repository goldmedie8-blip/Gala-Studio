// One shared AudioContext for the whole app. The engine is shared infrastructure:
// tools import from here and never create their own context.
let context = null

export function getAudioContext() {
  if (context) return context
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio is not supported in this browser')
  context = new Ctor({ latencyHint: 'interactive' })
  return context
}

// Browsers keep audio suspended until the person taps something. Call this from a click/tap handler.
export async function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  return ctx
}

export function resetAudioContextForTests() {
  context = null
}
