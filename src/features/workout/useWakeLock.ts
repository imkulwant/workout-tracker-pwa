import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { getSetting } from '../../data/repositories/settings'
import { wakeLock } from '../../platform/wakeLock'

/** Keeps the screen on while the caller is mounted, if the setting allows. */
export function useWakeLock(): void {
  const enabled = useLiveQuery(() => getSetting('wakeLockEnabled'))
  useEffect(() => {
    if (enabled !== true) return
    void wakeLock.start()
    return () => void wakeLock.stop()
  }, [enabled])
}
