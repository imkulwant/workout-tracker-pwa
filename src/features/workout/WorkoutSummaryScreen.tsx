import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router'
import { listExercises } from '../../data/repositories/exercises'
import { listWorkoutSets } from '../../data/repositories/sets'
import { getWorkout } from '../../data/repositories/workouts'
import { formatDurationShort, formatVolumeKg } from '../../domain/format'
import {
  countMetricSets,
  muscleSetCounts,
  totalVolumeKg,
  workoutDurationMs,
} from '../../domain/metrics'
import { MUSCLE_LABELS } from '../../domain/muscles'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Screen } from '../../ui/Screen'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-card bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}

/** `/workout/:id/summary`: what a finished workout came to. */
export function WorkoutSummaryScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const workout = (await getWorkout(id)) ?? null
    if (!workout) return { workout }
    const [sets, exercises] = await Promise.all([
      listWorkoutSets(id),
      listExercises({ includeArchived: true }),
    ])
    return { workout, sets, exercises }
  }, [id])

  if (data === undefined) return null
  if (!data.workout || !data.sets || !data.exercises) {
    return (
      <Screen title="Workout" back="/">
        <EmptyState
          title="Workout not found"
          description="It may have been deleted."
        />
      </Screen>
    )
  }
  const { workout, sets, exercises } = data
  const muscles = muscleSetCounts(
    sets,
    new Map(exercises.map((exercise) => [exercise.id, exercise])),
  )

  return (
    <Screen title="Workout done">
      <p className="text-lg font-semibold">{workout.title || 'Workout'}</p>
      <dl className="grid grid-cols-3 gap-2">
        <Tile
          label="Duration"
          value={formatDurationShort(workoutDurationMs(workout))}
        />
        <Tile label="Sets" value={String(countMetricSets(sets))} />
        <Tile
          label="Volume"
          value={`${formatVolumeKg(totalVolumeKg(sets))} kg`}
        />
      </dl>

      <section
        aria-labelledby="muscles-heading"
        className="flex flex-col gap-2 rounded-card bg-surface p-4"
      >
        <h2 id="muscles-heading" className="text-sm text-muted">
          Muscles worked
        </h2>
        {muscles.length === 0 ? (
          <p className="text-muted">No sets counted.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {muscles.map(([muscle, count]) => (
              <li key={muscle} className="flex justify-between">
                <span>{MUSCLE_LABELS[muscle]}</span>
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button onClick={() => void navigate('/', { replace: true })}>
        Done
      </Button>
    </Screen>
  )
}
