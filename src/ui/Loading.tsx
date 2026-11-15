import { useEffect, useState } from 'react'

/** Shown by a screen that is still reading the database. */
export const LOADING_DELAY_MS = 250

/**
 * "Loading…" with a status role. It waits a moment before showing, because the
 * database usually answers in a few milliseconds and a flash of text would be
 * worse than a blank for that long.
 */
export function Loading({ delayMs = LOADING_DELAY_MS }: { delayMs?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])

  return (
    <p
      role="status"
      aria-live="polite"
      className="px-3 py-6 text-center text-muted"
    >
      {visible ? 'Loading…' : ''}
    </p>
  )
}
