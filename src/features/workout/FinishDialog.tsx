import { useLiveQuery } from 'dexie-react-hooks'
import { listWorkoutSets } from '../../data/repositories/sets'
import type { Id } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'

export interface FinishDialogProps {
  open: boolean
  workoutId: Id
  onClose: () => void
  /** Finish, dropping the sets that were never ticked. */
  onFinishDiscardingIncomplete: () => void
  /** Throw the whole workout away. */
  onDiscard: () => void
}

/** What to do when Finish is tapped and the workout is not all ticked off. */
export function FinishDialog({
  open,
  workoutId,
  onClose,
  onFinishDiscardingIncomplete,
  onDiscard,
}: FinishDialogProps) {
  const sets = useLiveQuery(() => listWorkoutSets(workoutId), [workoutId])
  const done = sets?.filter((set) => set.completedAt !== null).length ?? 0
  const incomplete = (sets?.length ?? 0) - done

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={done === 0 ? 'Nothing logged' : 'Unfinished sets'}
    >
      {done === 0 ? (
        <>
          <p className="mb-4 text-muted">
            No set has been completed, so there is nothing to save.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={onClose}>Keep editing</Button>
            <Button variant="danger" onClick={onDiscard}>
              Discard workout
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-muted">
            {incomplete === 1
              ? '1 set is not completed.'
              : `${incomplete} sets are not completed.`}{' '}
            Finishing removes them from the workout.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={onClose}>Keep editing</Button>
            <Button variant="danger" onClick={onFinishDiscardingIncomplete}>
              Discard incomplete
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
