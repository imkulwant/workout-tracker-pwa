import { useEffect, useState } from 'react'
import {
  makeBackupFile,
  recordBackupSaved,
} from '../features/settings/backupFiles'
import { saveFile } from '../platform/share'
import { watchStorageFailures } from '../platform/storageFailure'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

/**
 * Listens for a write the device refused (no space, a dead transaction) and
 * blocks the app with a plain message and a way to save a backup. It never
 * lets the app carry on as if the change had been stored.
 */
export function StorageFailureGate() {
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => watchStorageFailures(() => setFailed(true)), [])

  async function exportNow() {
    setNote(null)
    try {
      const result = await saveFile(await makeBackupFile())
      if (result === 'shared' || result === 'downloaded') {
        await recordBackupSaved().catch(() => {})
        setNote('Backup saved.')
      }
    } catch {
      setNote('The backup could not be made either.')
    }
  }

  return (
    <Dialog
      open={failed}
      // Blocking on purpose: closing it would hide that a change was lost.
      onClose={() => {}}
      title="Could not save to this device"
    >
      <p className="mb-4 text-muted">
        The last change was not stored. The device may be out of space. Save a
        backup now, free some space, then reload.
      </p>
      <div className="flex flex-col gap-2">
        <Button onClick={() => void exportNow()}>Export backup</Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
      {note && (
        <p role="status" className="mt-3 text-muted">
          {note}
        </p>
      )}
    </Dialog>
  )
}
