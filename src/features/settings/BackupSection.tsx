import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getSetting } from '../../data/repositories/settings'
import { toLocalDate } from '../../domain/dates'
import { formatDayWithYear } from '../../domain/format'
import { saveFile, type SaveResult } from '../../platform/share'
import { Button } from '../../ui/Button'
import { makeBackupFile, makeCsvFile, recordBackupSaved } from './backupFiles'
import { ImportBackup } from './ImportBackup'

/** Save, export and restore the data. The only copy of it is on this phone. */
export function BackupSection() {
  const lastBackupAt = useLiveQuery(() => getSetting('lastBackupAt'))
  // A file that is built but not yet saved, when iOS wanted a fresh tap.
  const [pending, setPending] = useState<{
    file: File
    kind: 'json' | 'csv'
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function finish(result: SaveResult, file: File, kind: 'json' | 'csv') {
    if (result === 'blocked') {
      setPending({ file, kind })
      setMessage('The file is ready. Tap Save file to choose where it goes.')
      return
    }
    setPending(null)
    if (result === 'cancelled') {
      setMessage(null)
      return
    }
    if (kind === 'json') await recordBackupSaved()
    setMessage(kind === 'json' ? 'Backup saved.' : 'Sets exported.')
  }

  async function exportAs(kind: 'json' | 'csv') {
    setMessage(null)
    const file = kind === 'json' ? await makeBackupFile() : await makeCsvFile()
    await finish(await saveFile(file), file, kind)
  }

  return (
    <section
      aria-labelledby="backup-heading"
      className="flex flex-col gap-3 rounded-card bg-surface p-4"
    >
      <h2 id="backup-heading" className="text-sm text-muted">
        Backup
      </h2>
      <p className="text-lg font-semibold">
        {lastBackupAt === undefined
          ? 'Checking…'
          : lastBackupAt === null
            ? 'Never backed up'
            : `Last backup ${formatDayWithYear(toLocalDate(lastBackupAt))}`}
      </p>
      <p className="text-muted">
        Your workouts live only on this phone. Save a backup to Files now and
        then.
      </p>
      <Button onClick={() => void exportAs('json')}>Save backup</Button>
      <Button variant="secondary" onClick={() => void exportAs('csv')}>
        Export sets as CSV
      </Button>
      <ImportBackup />
      {pending && (
        <Button
          onClick={() =>
            void saveFile(pending.file).then((result) =>
              finish(result, pending.file, pending.kind),
            )
          }
        >
          Save file
        </Button>
      )}
      {message && (
        <p role="status" className="text-muted">
          {message}
        </p>
      )}
    </section>
  )
}
