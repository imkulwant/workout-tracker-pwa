import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { listExercises } from '../../data/repositories/exercises'
import { listWorkoutSets } from '../../data/repositories/sets'
import {
  deleteWorkout,
  getWorkout,
  listWorkoutExercises,
  restoreWorkout,
} from '../../data/repositories/workouts'
import { formatDayWithYear } from '../../domain/format'
import { toTimeOfDay } from '../../domain/workoutEdit'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Loading } from '../../ui/Loading'
import { Screen } from '../../ui/Screen'
import { useToast } from '../../ui/Toast'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { SaveAsTemplate } from '../templates/SaveAsTemplate'
import { WorkoutRecords } from '../stats/WorkoutRecords'
import { addExercisesToWorkout, moveWorkoutExercise } from '../workout/actions'
import { ExerciseCard } from '../workout/ExerciseCard'
import { WorkoutTotals } from '../workout/WorkoutTotals'
import { WorkoutDetailsSheet } from './WorkoutDetailsSheet'

/** `/history/:id`: a finished workout, with everything in it editable. */
export function WorkoutDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const data = useLiveQuery(async () => {
    const workout = (await getWorkout(id)) ?? null
    if (!workout) return { workout }
    const [rows, sets, exercises] = await Promise.all([
      listWorkoutExercises(id),
      listWorkoutSets(id),
      listExercises({ includeArchived: true }),
    ])
    return { workout, rows, sets, exercises }
  }, [id])

  if (data === undefined) {
    return (
      <Screen title="Workout" back="/history">
        <Loading />
      </Screen>
    )
  }
  if (!data.workout || !data.rows || !data.sets || !data.exercises) {
    return (
      <Screen title="Workout" back="/history">
        <EmptyState
          title="Workout not found"
          description="It may have been deleted."
        />
      </Screen>
    )
  }
  const { workout, rows, sets, exercises } = data
  // A workout in progress is logged on its own screen.
  if (workout.status === 'active') return <Navigate to="/workout" replace />

  async function remove() {
    setDeleting(false)
    await deleteWorkout(workout.id)
    void navigate('/history', { replace: true })
    toast.show({
      message: 'Workout deleted',
      actionLabel: 'Undo',
      onAction: () => void restoreWorkout(workout.id),
    })
  }

  return (
    <Screen title="Workout" back="/history">
      <section className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">{workout.title || 'Workout'}</h2>
        <p className="text-muted">
          {formatDayWithYear(workout.date)} · {toTimeOfDay(workout.startedAt)}
          {workout.endedAt !== null && `–${toTimeOfDay(workout.endedAt)}`}
        </p>
        {workout.notes && <p className="mt-1">{workout.notes}</p>}
        <div className="mt-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        </div>
      </section>

      <WorkoutTotals workout={workout} sets={sets} exercises={exercises} />
      <WorkoutRecords workout={workout} />

      {rows.map((row, index) => (
        <ExerciseCard
          key={row.id}
          row={row}
          index={index}
          count={rows.length}
          onMove={(direction) =>
            void moveWorkoutExercise(workout.id, rows, index, direction)
          }
        />
      ))}

      <Button variant="secondary" onClick={() => setPicking(true)}>
        Add exercise
      </Button>
      <SaveAsTemplate
        workoutId={workout.id}
        defaultName={
          workout.title || `Workout ${formatDayWithYear(workout.date)}`
        }
      />
      <Button variant="danger" onClick={() => setDeleting(true)}>
        Delete workout
      </Button>

      <WorkoutDetailsSheet
        open={editing}
        workout={workout}
        onClose={() => setEditing(false)}
      />
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={(chosen) => {
          setPicking(false)
          void addExercisesToWorkout(workout.id, chosen)
        }}
      />
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this workout?"
      >
        <p className="mb-4 text-muted">
          Its exercises and sets are deleted too. You can undo this for a few
          seconds.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDeleting(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => void remove()}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </Screen>
  )
}
