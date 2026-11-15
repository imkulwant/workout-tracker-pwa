import { describe, expect, it, vi } from 'vitest'
import {
  UPDATE_CHECK_MS,
  createUpdateWatcher,
  type ContainerLike,
  type RegistrationLike,
  type WorkerLike,
} from './updates'

function worker(state = 'installed') {
  const handlers: (() => void)[] = []
  const w: WorkerLike & { fire(): void; messages: unknown[] } = {
    state,
    messages: [],
    postMessage(message) {
      this.messages.push(message)
    },
    addEventListener(_type, listener) {
      handlers.push(listener)
    },
    fire() {
      handlers.forEach((h) => h())
    },
  }
  return w
}

function setup(
  options: {
    controller?: boolean
    waiting?: WorkerLike | null
    installing?: WorkerLike | null
    noRegistration?: boolean
  } = {},
) {
  const regHandlers: (() => void)[] = []
  const containerHandlers: (() => void)[] = []
  const update = vi.fn(async () => {})
  const registration: RegistrationLike & { fireUpdateFound(): void } = {
    waiting: options.waiting ?? null,
    installing: options.installing ?? null,
    addEventListener: (_t, l) => void regHandlers.push(l),
    update,
    fireUpdateFound: () => regHandlers.forEach((h) => h()),
  }
  const container: ContainerLike & { fireControllerChange(): void } = {
    controller: options.controller === false ? null : {},
    getRegistration: async () =>
      options.noRegistration ? undefined : registration,
    addEventListener: (_t, l) => void containerHandlers.push(l),
    fireControllerChange: () => containerHandlers.forEach((h) => h()),
  }
  const visibility: (() => void)[] = []
  const doc = {
    visibilityState: 'visible',
    addEventListener: (_t: 'visibilitychange', l: () => void) =>
      void visibility.push(l),
  }
  const reload = vi.fn()
  let tick: (() => void) | undefined
  const watcher = createUpdateWatcher({
    serviceWorker: container,
    document: doc,
    reload,
    setInterval: (handler) => void (tick = handler),
  })
  return {
    watcher,
    registration,
    container,
    doc,
    reload,
    update,
    visibility,
    tick: () => tick?.(),
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createUpdateWatcher', () => {
  it('is not ready when nothing is waiting', async () => {
    const { watcher } = setup()
    const states: boolean[] = []
    watcher.subscribe((ready) => states.push(ready))
    await flush()
    expect(states).toEqual([false])
    expect(watcher.isReady()).toBe(false)
  })

  it('is ready when a version is already waiting at launch', async () => {
    const { watcher } = setup({ waiting: worker() })
    const states: boolean[] = []
    watcher.subscribe((ready) => states.push(ready))
    await flush()
    expect(states).toEqual([false, true])
  })

  it('becomes ready when a found update finishes installing', async () => {
    const { watcher, registration } = setup()
    const states: boolean[] = []
    watcher.subscribe((ready) => states.push(ready))
    await flush()

    const installing = worker('installing')
    registration.installing = installing
    registration.fireUpdateFound()
    expect(watcher.isReady()).toBe(false)
    installing.state = 'installed'
    installing.fire()

    expect(states).toEqual([false, true])
  })

  it('follows a version that was already installing at launch', async () => {
    const installing = worker('installing')
    const { watcher } = setup({ installing })
    watcher.subscribe(() => {})
    await flush()
    installing.state = 'installed'
    installing.fire()
    expect(watcher.isReady()).toBe(true)
  })

  it('treats the first install as no update', async () => {
    const first = worker()
    const { watcher } = setup({ controller: false, waiting: first })
    watcher.subscribe(() => {})
    await flush()
    expect(watcher.isReady()).toBe(false)
  })

  it('ignores a worker that only reached some other state', async () => {
    const { watcher, registration } = setup()
    watcher.subscribe(() => {})
    await flush()
    const installing = worker('installing')
    registration.installing = installing
    registration.fireUpdateFound()
    installing.state = 'activating'
    installing.fire()
    expect(watcher.isReady()).toBe(false)
  })

  it('does nothing without a registration or without service worker support', async () => {
    const none = setup({ noRegistration: true })
    none.watcher.subscribe(() => {})
    await flush()
    expect(none.watcher.isReady()).toBe(false)

    const unsupported = createUpdateWatcher({ reload: vi.fn() })
    const states: boolean[] = []
    unsupported.subscribe((ready) => states.push(ready))
    expect(states).toEqual([false])
    expect(unsupported.apply()).toBe(false)
  })

  it('stops calling a listener that unsubscribed', async () => {
    const { watcher, registration } = setup()
    const listener = vi.fn()
    const stop = watcher.subscribe(listener)
    await flush()
    stop()
    const installing = worker('installing')
    registration.installing = installing
    registration.fireUpdateFound()
    installing.state = 'installed'
    installing.fire()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('apply', () => {
  it('does nothing when no version is waiting', async () => {
    const { watcher, container, reload } = setup()
    watcher.subscribe(() => {})
    await flush()
    expect(watcher.apply()).toBe(false)
    container.fireControllerChange()
    expect(reload).not.toHaveBeenCalled()
  })

  it('asks the waiting version to take over, and reloads when it has', async () => {
    const waiting = worker()
    const { watcher, container, reload } = setup({ waiting })
    watcher.subscribe(() => {})
    await flush()

    expect(watcher.apply()).toBe(true)
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }])
    expect(reload).not.toHaveBeenCalled()
    container.fireControllerChange()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('never reloads a page that did not ask, even if the version changes under it', async () => {
    const waiting = worker()
    const { watcher, container, reload } = setup({ waiting })
    watcher.subscribe(() => {})
    await flush()

    // Another tab switched versions. This page, say a workout, must stay as it is.
    container.fireControllerChange()
    expect(reload).not.toHaveBeenCalled()
    expect(waiting.messages).toEqual([])
  })
})

describe('checking for updates', () => {
  it('asks the server when the app becomes visible, and on a timer', async () => {
    const { watcher, doc, visibility, update, tick } = setup()
    watcher.subscribe(() => {})
    await flush()

    visibility.forEach((h) => h())
    expect(update).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'hidden'
    visibility.forEach((h) => h())
    expect(update).toHaveBeenCalledTimes(1)

    tick()
    expect(update).toHaveBeenCalledTimes(2)
    expect(UPDATE_CHECK_MS).toBe(3_600_000)
  })

  it('survives a failed check', async () => {
    const { watcher, update, tick } = setup()
    update.mockRejectedValueOnce(new Error('offline'))
    watcher.subscribe(() => {})
    await flush()
    expect(() => tick()).not.toThrow()
    await flush()
  })
})
