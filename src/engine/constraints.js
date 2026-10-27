// Microphone settings for recording music. Browser defaults are tuned for phone calls:
// echo cancellation, noise suppression and auto gain colour the sound of vocals and guitar
// and add delay. Turning them off gives a clean, lower-latency signal.
export const RECORDING_CONSTRAINTS = Object.freeze({
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  latency: 0,
  channelCount: 1,
})

export function audioInputConstraints(deviceId) {
  return {
    audio: deviceId ? { ...RECORDING_CONSTRAINTS, deviceId: { exact: deviceId } } : { ...RECORDING_CONSTRAINTS },
  }
}
