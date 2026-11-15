import { describe, expect, it } from 'vitest'
import { createWakeLock, type WakeLockEnv } from './wakeLock'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A fake browser: a wake lock API, and a page that can hide and show. */
function fakeBrowser(
  options: {
    visible?: boolean
    supported?: boolean
    refuseFirst?: boolean
  } = {},
) {
  const state = {
    visible: options.visible ?? true,
    requests: 0,
    sentinels: [] as ReturnType<typeof makeSentinel>[],
    listeners: new Set<() => void>(),
    refuseNext: options.refuseFirst ?? false,
  }

  function makeSentinel() {
    const releaseListeners: (() => void)[] = []
    return {
      released: false,
      releaseCalls: 0,
      async release() {
        this.releaseCalls += 1
        this.released = true
      },
      addEventListener(_type: 'release', listener: () => void) {
        releaseListeners.push(listener)
      },
      /** What iOS does when the app is hidden. */
      systemRelease() {
        this.released = true
        releaseListeners.forEach((listener) => listener())
      },
    }
  }

  const env: WakeLockEnv = {
    navigator:
      options.supported === false
        ? {}
        : {
            wakeLock: {
              request: async () => {
                state.requests += 1
                if (state.refuseNext) {
                  state.refuseNext = false
                  throw new Error('NotAllowedError')
                }
                const sentinel = makeSentinel()
                state.sentinels.push(sentinel)
                return sentinel
              },
            },
          },
    document: {
      get visibilityState() {
        return state.visible ? 'visible' : 'hidden'
      },
      addEventListener: (_type, listener) => void state.listeners.add(listener),
      removeEventListener: (_type, listener) =>
        void state.listeners.delete(listener),
    },
  }

  return {
    env,
    state,
    setVisible(visible: boolean) {
      state.visible = visible
      state.listeners.forEach((listener) => listener())
    },
  }
}

describe('createWakeLock', () => {
  it('requests the lock when started on a visible page', async () => {
    const { env, state } = fakeBrowser()
    const lock = createWakeLock(env)

    await lock.start()

    expect(state.requests).toBe(1)
    expect(lock.isActive()).toBe(true)
  })

  it('asks only once however often it is started', async () => {
    const { env, state } = fakeBrowser()
    const lock = createWakeLock(env)

    await lock.start()
    await lock.start()
    await lock.start()

    expect(state.requests).toBe(1)
    expect(state.listeners.size).toBe(1)
  })

  it('waits while the page is hidden, then takes the lock when it shows', async () => {
    const browser = fakeBrowser({ visible: false })
    const lock = createWakeLock(browser.env)

    await lock.start()
    expect(browser.state.requests).toBe(0)

    browser.setVisible(true)
    await settle()

    expect(browser.state.requests).toBe(1)
    expect(lock.isActive()).toBe(true)
  })

  it('takes the lock again after iOS drops it when the app was hidden', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock(browser.env)
    await lock.start()

    browser.state.sentinels[0]!.systemRelease()
    expect(lock.isActive()).toBe(false)
    browser.setVisible(false)
    browser.setVisible(true)
    await settle()

    expect(browser.state.requests).toBe(2)
    expect(lock.isActive()).toBe(true)
  })

  it('does not ask again while it still holds the lock', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock(browser.env)
    await lock.start()

    browser.setVisible(false)
    browser.setVisible(true)
    await settle()

    expect(browser.state.requests).toBe(1)
  })

  it('survives a refused request and tries again when the app shows next', async () => {
    const browser = fakeBrowser({ refuseFirst: true })
    const lock = createWakeLock(browser.env)

    await expect(lock.start()).resolves.toBeUndefined()
    expect(lock.isActive()).toBe(false)

    browser.setVisible(false)
    browser.setVisible(true)
    await settle()

    expect(browser.state.requests).toBe(2)
    expect(lock.isActive()).toBe(true)
  })

  it('releases the lock and stops reacting when stopped', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock(browser.env)
    await lock.start()

    await lock.stop()

    expect(browser.state.sentinels[0]!.releaseCalls).toBe(1)
    expect(lock.isActive()).toBe(false)
    expect(browser.state.listeners.size).toBe(0)
    browser.setVisible(false)
    browser.setVisible(true)
    await settle()
    expect(browser.state.requests).toBe(1)
  })

  it('releases a lock that arrives after it was stopped', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock(browser.env)

    const starting = lock.start()
    await lock.stop()
    await starting
    await settle()

    expect(lock.isActive()).toBe(false)
    expect(browser.state.sentinels.every((s) => s.released)).toBe(true)
  })

  it('can be started again after being stopped', async () => {
    const browser = fakeBrowser()
    const lock = createWakeLock(browser.env)
    await lock.start()
    await lock.stop()

    await lock.start()

    expect(browser.state.requests).toBe(2)
    expect(lock.isActive()).toBe(true)
  })

  it('does nothing where wake locks are not supported', async () => {
    const browser = fakeBrowser({ supported: false })
    const lock = createWakeLock(browser.env)

    expect(lock.supported).toBe(false)
    await expect(lock.start()).resolves.toBeUndefined()
    await expect(lock.stop()).resolves.toBeUndefined()
    expect(browser.state.listeners.size).toBe(0)
    expect(lock.isActive()).toBe(false)
  })

  it('stopping when never started does nothing', async () => {
    const lock = createWakeLock(fakeBrowser().env)

    await expect(lock.stop()).resolves.toBeUndefined()
  })
})
