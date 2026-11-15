// Finding out that a new version of the app is waiting, and switching to it
// only when asked. The service worker is built to wait (`registerType:
// 'prompt'`), so a new version never takes over by itself: the old pages keep
// running it until `apply` sends the waiting worker a SKIP_WAITING message.

export interface WorkerLike {
  state: string
  postMessage(message: unknown): void
  addEventListener(type: 'statechange', listener: () => void): void
}

export interface RegistrationLike {
  waiting: WorkerLike | null
  installing: WorkerLike | null
  addEventListener(type: 'updatefound', listener: () => void): void
  update(): Promise<unknown>
}

export interface ContainerLike {
  /** Null until a worker controls the page, so null means a first visit. */
  controller: unknown
  getRegistration(): Promise<RegistrationLike | undefined>
  addEventListener(type: 'controllerchange', listener: () => void): void
}

export interface UpdateEnv {
  serviceWorker?: ContainerLike
  document?: {
    visibilityState: string
    addEventListener(type: 'visibilitychange', listener: () => void): void
  }
  reload(): void
  setInterval?(handler: () => void, ms: number): unknown
}

export interface UpdateWatcher {
  /** Whether a new version is installed and waiting. */
  isReady(): boolean
  /** Calls `listener` now and whenever readiness changes. Returns a stop function. */
  subscribe(listener: (ready: boolean) => void): () => void
  /**
   * Switches to the waiting version and reloads the page that asked. Returns
   * false, and does nothing, when no version is waiting.
   */
  apply(): boolean
}

/** How often to ask the server for a new version while the app stays open. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000

export function createUpdateWatcher(env: UpdateEnv): UpdateWatcher {
  const container = env.serviceWorker
  const listeners = new Set<(ready: boolean) => void>()
  let waiting: WorkerLike | null = null
  let registration: RegistrationLike | undefined
  let started = false
  let applying = false

  const notify = () =>
    listeners.forEach((listener) => listener(waiting !== null))

  function markWaiting(worker: WorkerLike | null) {
    // With no controller this is the first install, not an update.
    if (!worker || !container?.controller) return
    waiting = worker
    notify()
  }

  function watch(worker: WorkerLike) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') markWaiting(worker)
    })
  }

  async function start() {
    if (started || !container) return
    started = true
    // Only the page that asked for the switch reloads. A page that was left
    // running, such as a workout, never changes under the person using it.
    container.addEventListener('controllerchange', () => {
      if (applying) env.reload()
    })
    try {
      registration = await container.getRegistration()
    } catch {
      return
    }
    if (!registration) return
    markWaiting(registration.waiting)
    if (registration.installing) watch(registration.installing)
    registration.addEventListener('updatefound', () => {
      if (registration?.installing) watch(registration.installing)
    })

    const check = () => void registration?.update().catch(() => {})
    env.document?.addEventListener('visibilitychange', () => {
      if (env.document?.visibilityState === 'visible') check()
    })
    env.setInterval?.(check, UPDATE_CHECK_MS)
  }

  return {
    isReady: () => waiting !== null,

    subscribe(listener) {
      listeners.add(listener)
      listener(waiting !== null)
      void start()
      return () => listeners.delete(listener)
    },

    apply() {
      if (!waiting) return false
      applying = true
      waiting.postMessage({ type: 'SKIP_WAITING' })
      return true
    },
  }
}

const browser = globalThis as unknown as {
  navigator?: { serviceWorker?: ContainerLike }
  document?: UpdateEnv['document']
  location?: { reload(): void }
  setInterval?: UpdateEnv['setInterval']
}

export const updates = createUpdateWatcher({
  serviceWorker: browser.navigator?.serviceWorker,
  document: browser.document,
  reload: () => browser.location?.reload(),
  setInterval: browser.setInterval?.bind(globalThis),
})
