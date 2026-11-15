// A short tone for the end of a rest. iOS only lets audio start from a tap, so
// the audio context is created in `unlock`, called from the tap that ticks a
// set. The tone can then play later with no tap, while the app is open.

interface ParamLike {
  setValueAtTime(value: number, time: number): unknown
  linearRampToValueAtTime(value: number, time: number): unknown
}
interface OscillatorLike {
  type: string
  frequency: { value: number }
  connect(node: unknown): unknown
  start(time: number): void
  stop(time: number): void
}
interface GainLike {
  gain: ParamLike
  connect(node: unknown): unknown
}
interface AudioContextLike {
  state: string
  currentTime: number
  destination: unknown
  resume(): Promise<void>
  createOscillator(): OscillatorLike
  createGain(): GainLike
}

export interface SoundEnv {
  AudioContext?: new () => AudioContextLike
  webkitAudioContext?: new () => AudioContextLike
}

export interface Sound {
  /** Call from a tap handler. Creates and wakes the audio context. Never throws. */
  unlock(): void
  /** Plays two short beeps. Returns false, silently, if it cannot. Never throws. */
  playRestTone(): boolean
}

const BEEP_HZ = 880
const BEEP_GAIN = 0.25
const BEEP_OFFSETS_S = [0, 0.25]

export function createSound(env: SoundEnv): Sound {
  const Context = env.AudioContext ?? env.webkitAudioContext
  let context: AudioContextLike | null = null

  return {
    unlock() {
      if (!Context) return
      try {
        context ??= new Context()
        if (context.state === 'suspended') void context.resume().catch(() => {})
      } catch {
        // Audio is a nicety, so a failure must never break the tap.
      }
    },

    playRestTone() {
      if (!context || context.state !== 'running') return false
      try {
        const start = context.currentTime
        for (const offset of BEEP_OFFSETS_S) {
          const at = start + offset
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.value = BEEP_HZ
          // A short ramp up and down avoids clicks at the edges of the beep.
          gain.gain.setValueAtTime(0, at)
          gain.gain.linearRampToValueAtTime(BEEP_GAIN, at + 0.02)
          gain.gain.linearRampToValueAtTime(0, at + 0.15)
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.start(at)
          oscillator.stop(at + 0.16)
        }
        return true
      } catch {
        return false
      }
    },
  }
}

const sound = createSound(globalThis as unknown as SoundEnv)
export const unlockAudio = sound.unlock
export const playRestTone = sound.playRestTone
