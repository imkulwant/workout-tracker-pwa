import { useEffect, useState } from 'react'
import { formatBytes } from '../../domain/format'
import {
  getPersistenceState,
  getStorageEstimate,
  type PersistenceState,
  type StorageEstimate,
} from '../../platform/storage'

const COPY: Record<PersistenceState, { label: string; detail: string }> = {
  granted: {
    label: 'Granted',
    detail: 'The browser keeps your data unless you delete the app.',
  },
  denied: {
    label: 'Not granted',
    detail: 'iOS may clear your data when storage runs low. Back up regularly.',
  },
  unsupported: {
    label: 'Unavailable',
    detail: 'This device cannot protect storage. Back up regularly.',
  },
}

/** Shows whether the browser has promised to keep this app's data. */
export function StorageStatus() {
  const [state, setState] = useState<PersistenceState | null>(null)
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)

  useEffect(() => {
    let cancelled = false
    void getPersistenceState().then((result) => {
      if (!cancelled) setState(result)
    })
    void getStorageEstimate().then((result) => {
      if (!cancelled) setEstimate(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      aria-labelledby="storage-heading"
      className="flex flex-col gap-1 rounded-card bg-surface p-4"
    >
      <h2 id="storage-heading" className="text-sm text-muted">
        Persistent storage
      </h2>
      <p className="text-lg font-semibold">
        {state ? COPY[state].label : 'Checking…'}
      </p>
      {state && <p className="text-muted">{COPY[state].detail}</p>}
      {estimate && (
        <p className="text-muted">
          Using {formatBytes(estimate.usageBytes)} of{' '}
          {formatBytes(estimate.quotaBytes)} available.
        </p>
      )}
    </section>
  )
}
