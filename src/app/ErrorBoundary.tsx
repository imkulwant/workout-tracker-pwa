import { Component, useState, type ReactNode } from 'react'
import {
  makeBackupFile,
  recordBackupSaved,
} from '../features/settings/backupFiles'
import { saveFile } from '../platform/share'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

function Fallback() {
  const [note, setNote] = useState<string | null>(null)

  async function exportNow() {
    setNote(null)
    try {
      const result = await saveFile(await makeBackupFile())
      if (result === 'shared' || result === 'downloaded') {
        await recordBackupSaved().catch(() => {})
        setNote('Backup saved.')
      }
    } catch {
      setNote('The backup could not be made.')
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <EmptyState
        title="Something went wrong"
        description="The app hit an unexpected error. Your workouts are still stored on this phone. Save a backup if you like, then reload."
      />
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Button variant="secondary" onClick={() => void exportNow()}>
          Export backup
        </Button>
        {note && (
          <p role="status" className="text-center text-muted">
            {note}
          </p>
        )}
      </div>
    </div>
  )
}

/** Catches an error thrown while drawing a screen, so the app never goes blank. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // Stays on the device: the console is the only place it goes.
    console.error('The app failed to draw a screen.', error)
  }

  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}
