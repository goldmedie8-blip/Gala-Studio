// A look-ahead scheduler. JavaScript timers are sloppy, but the audio clock is exact, so we wake up
// every 25 ms and schedule any steps that fall in the next 120 ms on the audio clock.
// This is what keeps a beat steady even when the phone is busy.
import { STEPS } from './pattern.js'

export const stepSeconds = (bpm) => 60 / bpm / 4

// Swing delays every second sixteenth. At full swing the delay is a third of a step.
export const swingDelay = (step, bpm, swing) => (step % 2 === 1 ? swing * 0.33 * stepSeconds(bpm) : 0)

export class Sequencer {
  constructor({ getTime, getBpm, getSwing, play, onStep, lookahead = 0.12, interval = 25 }) {
    Object.assign(this, { getTime, getBpm, getSwing, play, onStep, lookahead, interval })
    this.timer = null
    this.step = 0
    this.nextTime = 0
  }

  // `at` is an optional audio-clock time for step 0, so a beat can be lined up with something else.
  start(at) {
    this.stop()
    this.step = 0
    this.nextTime = at ?? this.getTime() + 0.06
    this.timer = setInterval(() => this.tick(), this.interval)
    this.tick()
  }

  tick() {
    while (this.nextTime < this.getTime() + this.lookahead) {
      const time = this.nextTime + swingDelay(this.step, this.getBpm(), this.getSwing())
      this.play(this.step, time)
      this.onStep?.(this.step, time)
      this.nextTime += stepSeconds(this.getBpm())
      this.step = (this.step + 1) % STEPS
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
