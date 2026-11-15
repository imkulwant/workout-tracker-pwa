import { dataMarker } from '../platform/dataMarker'
import { ImportBackup } from '../features/settings/ImportBackup'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

/**
 * Shown before anything else when this device once held workouts and now holds
 * none, which means the browser cleared its data. Restoring a backup is the
 * way back, and starting empty is a choice made on purpose.
 */
export function RestoreScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <EmptyState
        title="Your workouts are missing"
        description="This device held workouts before, but they are gone. The browser may have cleared its data. Restore a backup saved to Files to get them back."
      />
      <div className="flex w-full max-w-sm flex-col gap-3">
        <ImportBackup label="Restore from a backup" onImported={onDone} />
        <Button
          variant="ghost"
          onClick={() => {
            dataMarker.clear()
            onDone()
          }}
        >
          Start with no data
        </Button>
      </div>
    </div>
  )
}
