export type PersistenceState = 'granted' | 'denied' | 'unsupported'

export interface StorageManagerLike {
  persist?: () => Promise<boolean>
  persisted?: () => Promise<boolean>
  estimate?: () => Promise<{ usage?: number; quota?: number }>
}

const defaultStorage = (): StorageManagerLike | undefined =>
  globalThis.navigator?.storage

/**
 * Asks the browser to keep this app's storage through low-space clean-ups.
 * Called at launch. It never throws: a failure is reported as `denied`, so it
 * cannot stop the app from starting. Backups remain the real safety net.
 */
export async function requestPersistence(
  storage: StorageManagerLike | undefined = defaultStorage(),
): Promise<PersistenceState> {
  if (!storage?.persist) return 'unsupported'
  try {
    if (storage.persisted && (await storage.persisted())) return 'granted'
    return (await storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

/** The current state, without asking. Used to show the result in Settings. */
export async function getPersistenceState(
  storage: StorageManagerLike | undefined = defaultStorage(),
): Promise<PersistenceState> {
  if (!storage?.persisted) return 'unsupported'
  try {
    return (await storage.persisted()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

export interface StorageEstimate {
  usageBytes: number
  quotaBytes: number
}

/** How much storage this app uses and may use, or null when the browser does not say. */
export async function getStorageEstimate(
  storage: StorageManagerLike | undefined = defaultStorage(),
): Promise<StorageEstimate | null> {
  if (!storage?.estimate) return null
  try {
    const { usage, quota } = await storage.estimate()
    if (typeof usage !== 'number' || typeof quota !== 'number') return null
    return { usageBytes: usage, quotaBytes: quota }
  } catch {
    return null
  }
}
