// Keeps the screen on during a workout. iOS releases the lock whenever the app
// is hidden, so it is requested again when the app becomes visible. A request
// can also fail, for example on low battery, and is retried the next time the
// app becomes visible.

interface SentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockEnv {
  navigator?: {
    wakeLock?: { request(type: 'screen'): Promise<SentinelLike> }
  }
  document?: {
    visibilityState: string
    addEventListener(type: 'visibilitychange', listener: () => void): void
    removeEventListener(type: 'visibilitychange', listener: () => void): void
  }
}

export interface WakeLock {
  /** Whether this browser can hold a wake lock at all. */
  readonly supported: boolean
  /** Starts holding the screen on. Safe to call twice. Never throws. */
  start(): Promise<void>
  /** Lets the screen sleep again. Safe to call when not started. */
  stop(): Promise<void>
  /** Whether a lock is held right now. */
  isActive(): boolean
}

export function createWakeLock(env: WakeLockEnv): WakeLock {
  const api = env.navigator?.wakeLock
  const doc = env.document
  let wanted = false
  let sentinel: SentinelLike | null = null
  let requesting = false

  const visible = () => doc?.visibilityState === 'visible'
  const held = () => sentinel !== null && !sentinel.released

  async function acquire() {
    if (!api || !wanted || held() || requesting || !visible()) return
    requesting = true
    try {
      const lock = await api.request('screen')
      if (!wanted) {
        // stop() was called while the request was in flight.
        await lock.release().catch(() => {})
        return
      }
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null
      })
      sentinel = lock
    } catch {
      // Refused, for example on low battery. The next visible event retries.
    } finally {
      requesting = false
    }
  }

  const onVisibilityChange = () => {
    if (visible()) void acquire()
  }

  return {
    supported: Boolean(api),

    async start() {
      if (!api) return
      if (!wanted) {
        wanted = true
        doc?.addEventListener('visibilitychange', onVisibilityChange)
      }
      await acquire()
    },

    async stop() {
      if (!wanted) return
      wanted = false
      doc?.removeEventListener('visibilitychange', onVisibilityChange)
      const lock = sentinel
      sentinel = null
      await lock?.release().catch(() => {})
    },

    isActive: held,
  }
}

export const wakeLock = createWakeLock(globalThis as unknown as WakeLockEnv)
