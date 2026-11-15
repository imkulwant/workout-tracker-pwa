import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { DuplicateNameError } from '../../data/repositories/common'
import {
  archiveExercise,
  getExercise,
  unarchiveExercise,
} from '../../data/repositories/exercises'
import { EQUIPMENT_LABELS, LOAD_TYPE_LABELS } from '../../domain/exercises'
import { MUSCLE_LABELS } from '../../domain/muscles'
import type { MuscleId } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Loading } from '../../ui/Loading'
import { Screen } from '../../ui/Screen'
import { ExerciseStats } from '../stats/ExerciseStats'

const labels = (muscles: readonly MuscleId[]) =>
  muscles.length ? muscles.map((m) => MUSCLE_LABELS[m]).join(', ') : 'None'

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-surface px-4 py-3">
      <dt className="text-sm text-muted">{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** `/exercises/:id`: the exercise's details, with edit, archive and restore. */
export function ExerciseDetailScreen() {
  const { id = '' } = useParams()
  // `null` means there is no such exercise. `undefined` means still loading.
  const exercise = useLiveQuery(
    async () => (await getExercise(id)) ?? null,
    [id],
  )
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (exercise === undefined) {
    return (
      <Screen title="Exercise" back="/exercises">
        <Loading />
      </Screen>
    )
  }
  if (exercise === null) {
    return (
      <Screen title="Exercise" back="/exercises">
        <EmptyState
          title="Exercise not found"
          description="It may have been deleted."
        />
      </Screen>
    )
  }

  const archived = exercise.archivedAt !== null

  async function restore() {
    setError(null)
    try {
      await unarchiveExercise(id)
    } catch (caught) {
      if (caught instanceof DuplicateNameError) {
        setError(`${caught.message} Rename one of them first.`)
      } else {
        setError(`Could not restore: ${String(caught)}`)
      }
    }
  }

  return (
    <Screen title={exercise.name} back="/exercises">
      {archived && (
        <p className="rounded-control bg-surface p-3 text-muted">
          Archived. It is hidden from the exercise picker, and stays in your
          history.
        </p>
      )}

      <dl className="flex flex-col gap-2">
        <Row term="Equipment">{EQUIPMENT_LABELS[exercise.equipment]}</Row>
        <Row term="Load type">{LOAD_TYPE_LABELS[exercise.loadType]}</Row>
        <Row term="Primary muscles">{labels(exercise.primaryMuscles)}</Row>
        <Row term="Secondary muscles">{labels(exercise.secondaryMuscles)}</Row>
        <Row term="Default rest">
          {exercise.defaultRestSec === null
            ? 'Uses the global default'
            : `${exercise.defaultRestSec} s`}
        </Row>
        <Row term="Weight increment">{exercise.incrementKg} kg</Row>
        {exercise.notes && <Row term="Notes">{exercise.notes}</Row>}
      </dl>

      <ExerciseStats exercise={exercise} />

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Link
          to={`/exercises/${id}/edit`}
          className="tap-target flex items-center justify-center rounded-control bg-surface-2 px-4 font-semibold active:bg-border"
        >
          Edit
        </Link>
        {archived ? (
          <Button variant="secondary" onClick={restore}>
            Restore
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Archive
          </Button>
        )}
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Archive ${exercise.name}?`}
      >
        <p className="mb-4 text-muted">
          It will leave the exercise picker, but stay in your history. You can
          restore it later.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              setConfirming(false)
              await archiveExercise(id)
            }}
          >
            Archive
          </Button>
        </div>
      </Dialog>
    </Screen>
  )
}
