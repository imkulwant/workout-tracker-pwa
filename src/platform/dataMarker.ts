// Remembers, outside the database, that this device once held workouts. If the
// database is later empty while the marker is set, the data was lost (the
// browser cleared it), and the app offers a restore instead of starting over.

export const HAD_DATA_KEY = 'workout.hadData'

export interface MarkerStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const defaultStorage = (): MarkerStorage | undefined => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function createDataMarker(
  storage: MarkerStorage | undefined = defaultStorage(),
) {
  return {
    /** Never throws: private windows and blocked storage just forget it. */
    mark(): void {
      try {
        storage?.setItem(HAD_DATA_KEY, '1')
      } catch {
        // Nothing to do. The marker is an extra safety net.
      }
    },
    isSet(): boolean {
      try {
        return storage?.getItem(HAD_DATA_KEY) === '1'
      } catch {
        return false
      }
    },
    clear(): void {
      try {
        storage?.removeItem(HAD_DATA_KEY)
      } catch {
        // As above.
      }
    },
  }
}

/** The marker on this browser's `localStorage`, looked up on each call. */
export const dataMarker = {
  mark: () => createDataMarker(defaultStorage()).mark(),
  isSet: () => createDataMarker(defaultStorage()).isSet(),
  clear: () => createDataMarker(defaultStorage()).clear(),
}
