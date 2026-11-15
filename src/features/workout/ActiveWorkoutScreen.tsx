import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { listWorkoutSets } from '../../data/repositories/sets'
import {
  getActiveWorkout,
  listWorkoutExercises,
  startWorkout,
  updateWorkout,
} from '../../data/repositories/workouts'
import { formatClock } from '../../domain/format'
import { workoutDurationMs } from '../../domain/metrics'
import type { Workout } from '../../domain/types'
import { BackButton } from '../../ui/BackButton'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Screen } from '../../ui/Screen'
import { useNow } from '../../ui/useNow'
import { ExercisePicker } from '../exercises/ExercisePicker'
import {
  addExercisesToWorkout,
  discardWorkout,
  finishActiveWorkout,
  moveWorkoutExercise,
  startRestAfterSet,
} from './actions'
import { ExerciseCard } from './ExerciseCard'
import { FinishDialog } from './FinishDialog'
import { RestBar } from './RestBar'
import { useWakeLock } from './useWakeLock'

/** `/workout`: the workout in progress, or an offer to start one. */
export function ActiveWorkoutScreen() {
  // `null` means no workout in progress. `undefined` means still loading.
  const workout = useLiveQuery(async () => (await getActiveWorkout()) ?? null)

  if (workout === undefined) return null
  if (workout === null) {
    return (
      <Screen title="Workout" back="/">
        <EmptyState
          title="No workout in progress"
          description="Start one to log your sets."
          action={
            <Button onClick={() => void startWorkout()}>Start workout</Button>
          }
        />
      </Screen>
    )
  }
  return <WorkoutBody workout={workout} />
}

function WorkoutBody({ workout }: { workout: Workout }) {
  const rows = useLiveQuery(
    () => listWorkoutExercises(workout.id),
    [workout.id],
  )
  const now = useNow(1000)
  useWakeLock()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  // The title being typed; null when it is not being edited.
  const [titleDraft, setTitleDraft] = useState<string | null>(null)

  /** Finishes with nothing left to ask, or asks what to do with unticked sets. */
  async function finish() {
    const sets = await listWorkoutSets(workout.id)
    if (sets.length === 0 || sets.some((set) => set.completedAt === null)) {
      setFinishing(true)
      return
    }
    await complete(false)
  }

  async function complete(discardIncomplete: boolean) {
    setFinishing(false)
    await finishActiveWorkout(workout.id, { discardIncomplete })
    void navigate(`/workout/${workout.id}/summary`, { replace: true })
  }

  async function discard() {
    setFinishing(false)
    await discardWorkout(workout.id)
    void navigate('/', { replace: true })
  }

  async function saveTitle() {
    if (titleDraft === null) return
    const title = titleDraft.trim()
    setTitleDraft(null)
    if (title !== workout.title) await updateWorkout(workout.id, { title })
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-32">
      <header className="pt-safe sticky top-0 z-10 -mx-4 bg-bg px-4">
        <div className="flex items-center gap-2 pt-3 pb-2">
          <BackButton fallback="/" />
          <h1 className="sr-only">Workout</h1>
          <input
            aria-label="Workout title"
            placeholder="Workout"
            value={titleDraft ?? workout.title}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => void saveTitle()}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none placeholder:text-text"
          />
          <span
            role="timer"
            aria-label="Elapsed time"
            className="text-lg font-semibold tabular-nums text-muted"
          >
            {formatClock(workoutDurationMs(workout, now))}
          </span>
          <Button className="px-3" onClick={() => void finish()}>
            Finish
          </Button>
        </div>
      </header>

      {rows && rows.length === 0 && (
        <EmptyState
          title="Add your first exercise"
          description="Pick the exercises you will do today."
        />
      )}

      {rows?.map((row, index) => (
        <ExerciseCard
          key={row.id}
          row={row}
          index={index}
          count={rows.length}
          onMove={(direction) =>
            void moveWorkoutExercise(workout.id, rows, index, direction)
          }
          onSetCompleted={(set) => void startRestAfterSet(set)}
        />
      ))}

      <Button onClick={() => setPicking(true)}>Add exercise</Button>

      <RestBar />

      <FinishDialog
        open={finishing}
        workoutId={workout.id}
        onClose={() => setFinishing(false)}
        onFinishDiscardingIncomplete={() => void complete(true)}
        onDiscard={() => void discard()}
      />

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={(exercises) => {
          setPicking(false)
          void addExercisesToWorkout(workout.id, exercises)
        }}
      />
    </div>
  )
}
