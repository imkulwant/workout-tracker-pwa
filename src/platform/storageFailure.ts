// Tells the app when the device could not store something, so it can say so
// plainly instead of looking as if the change was saved.

export const STORAGE_FAILURE_EVENT = 'workout-storage-failure'

// Names of the errors IndexedDB raises when a write cannot complete: no space,
// a transaction that died, a database that closed, or Safari's internal error.
const FAILURE_NAMES = new Set([
  'QuotaExceededError',
  'AbortError',
  'TransactionInactiveError',
  'DatabaseClosedError',
  'UnknownError',
])

/** Whether an error means a write to the device failed. Looks through Dexie's `inner`. */
export function isStorageFailure(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current !== 'object') return false
    const { name, inner } = current as { name?: unknown; inner?: unknown }
    if (typeof name === 'string' && FAILURE_NAMES.has(name)) return true
    current = inner
  }
  return false
}

/** For code that catches an error itself: tells the gate if it was a storage failure. */
export function reportStorageFailure(
  error: unknown,
  target: EventTarget | undefined = globalThis,
): boolean {
  if (!isStorageFailure(error)) return false
  target?.dispatchEvent(new Event(STORAGE_FAILURE_EVENT))
  return true
}

/**
 * Calls `onFailure` for a reported failure and for any promise rejection or
 * error nobody handled. Returns a function that stops listening.
 */
export function watchStorageFailures(
  onFailure: () => void,
  target: EventTarget = globalThis,
): () => void {
  const reported = () => onFailure()
  const rejected = (event: Event) => {
    if (isStorageFailure((event as PromiseRejectionEvent).reason)) onFailure()
  }
  const thrown = (event: Event) => {
    if (isStorageFailure((event as ErrorEvent).error)) onFailure()
  }
  target.addEventListener(STORAGE_FAILURE_EVENT, reported)
  target.addEventListener('unhandledrejection', rejected)
  target.addEventListener('error', thrown)
  return () => {
    target.removeEventListener(STORAGE_FAILURE_EVENT, reported)
    target.removeEventListener('unhandledrejection', rejected)
    target.removeEventListener('error', thrown)
  }
}
