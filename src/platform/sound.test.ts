import { describe, expect, it, vi } from 'vitest'
import { createSound, type SoundEnv } from './sound'

/** A fake audio context that records what was scheduled. */
function fakeAudio(options: { state?: string; resumeFails?: boolean } = {}) {
  const log = {
    constructed: 0,
    resumed: 0,
    oscillators: [] as {
      frequency: number
      start: number
      stop: number
      type: string
    }[],
    gains: [] as { calls: [string, number, number][] }[],
  }
  class FakeContext {
    state = options.state ?? 'running'
    currentTime = 10
    destination = { name: 'destination' }
    constructor() {
      log.constructed += 1
    }
    resume = vi.fn(async () => {
      log.resumed += 1
      if (options.resumeFails) throw new Error('not allowed')
      this.state = 'running'
    })
    createOscillator() {
      const entry = { frequency: 0, start: 0, stop: 0, type: '' }
      log.oscillators.push(entry)
      return {
        set type(value: string) {
          entry.type = value
        },
        frequency: {
          set value(hz: number) {
            entry.frequency = hz
          },
        },
        connect: vi.fn(),
        start: (time: number) => void (entry.start = time),
        stop: (time: number) => void (entry.stop = time),
      } as never
    }
    createGain() {
      const record = { calls: [] as [string, number, number][] }
      log.gains.push(record)
      return {
        gain: {
          setValueAtTime: (v: number, t: number) =>
            void record.calls.push(['set', v, t]),
          linearRampToValueAtTime: (v: number, t: number) =>
            void record.calls.push(['ramp', v, t]),
        },
        connect: vi.fn(),
      } as never
    }
  }
  return { env: { AudioContext: FakeContext } as unknown as SoundEnv, log }
}

describe('createSound', () => {
  it('cannot play before it was unlocked by a tap', () => {
    const { env, log } = fakeAudio()
    const sound = createSound(env)

    expect(sound.playRestTone()).toBe(false)
    expect(log.constructed).toBe(0)
  })

  it('creates one audio context however many taps unlock it', () => {
    const { env, log } = fakeAudio()
    const sound = createSound(env)

    sound.unlock()
    sound.unlock()
    sound.unlock()

    expect(log.constructed).toBe(1)
  })

  it('wakes a suspended context, which is how iOS starts, and leaves a running one alone', async () => {
    const suspended = fakeAudio({ state: 'suspended' })
    const running = fakeAudio({ state: 'running' })

    createSound(suspended.env).unlock()
    createSound(running.env).unlock()
    await Promise.resolve()

    expect(suspended.log.resumed).toBe(1)
    expect(running.log.resumed).toBe(0)
  })

  it('plays two 880 Hz beeps a quarter of a second apart once unlocked', () => {
    const { env, log } = fakeAudio()
    const sound = createSound(env)
    sound.unlock()

    expect(sound.playRestTone()).toBe(true)

    expect(log.oscillators).toEqual([
      { type: 'sine', frequency: 880, start: 10, stop: 10.16 },
      { type: 'sine', frequency: 880, start: 10.25, stop: 10.41 },
    ])
  })

  it('shapes each beep with a quick fade in and out, so it does not click', () => {
    const { env, log } = fakeAudio()
    const sound = createSound(env)
    sound.unlock()

    sound.playRestTone()

    const [first] = log.gains
    expect(first!.calls.map(([kind, value]) => [kind, value])).toEqual([
      ['set', 0],
      ['ramp', 0.25],
      ['ramp', 0],
    ])
    expect(first!.calls[0]![2]).toBe(10)
  })

  it('stays silent if the context never woke up', async () => {
    const { env } = fakeAudio({ state: 'suspended', resumeFails: true })
    const sound = createSound(env)
    sound.unlock()
    await Promise.resolve()

    expect(sound.playRestTone()).toBe(false)
  })

  it('uses the prefixed constructor when that is all there is', () => {
    const { env, log } = fakeAudio()
    const prefixed: SoundEnv = { webkitAudioContext: env.AudioContext }
    const sound = createSound(prefixed)

    sound.unlock()

    expect(log.constructed).toBe(1)
    expect(sound.playRestTone()).toBe(true)
  })

  it('does nothing, without error, where audio does not exist', () => {
    const sound = createSound({})

    expect(() => sound.unlock()).not.toThrow()
    expect(sound.playRestTone()).toBe(false)
  })

  it('never throws, even if the browser fails', () => {
    const broken = createSound({
      AudioContext: class {
        constructor() {
          throw new Error('no audio device')
        }
      } as never,
    })
    expect(() => broken.unlock()).not.toThrow()
    expect(broken.playRestTone()).toBe(false)

    const { env } = fakeAudio()
    const sound = createSound(env)
    sound.unlock()
    // Make building a beep fail after the context exists.
    const Context = env.AudioContext as unknown as {
      prototype: { createOscillator: () => never }
    }
    Context.prototype.createOscillator = () => {
      throw new Error('boom')
    }
    expect(sound.playRestTone()).toBe(false)
  })
})
