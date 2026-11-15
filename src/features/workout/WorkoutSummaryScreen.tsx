import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router'
import { listExercises } from '../../data/repositories/exercises'
import { listWorkoutSets } from '../../data/repositories/sets'
import { formatDayWithYear } from '../../domain/format'
import { getWorkout } from '../../data/repositories/workouts'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Screen } from '../../ui/Screen'
import { SaveAsTemplate } from '../templates/SaveAsTemplate'
import { WorkoutRecords } from '../stats/WorkoutRecords'
import { WorkoutTotals } from './WorkoutTotals'

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

  return (
    <Screen title="Workout done">
      <p className="text-lg font-semibold">{workout.title || 'Workout'}</p>
      <WorkoutTotals workout={workout} sets={sets} exercises={exercises} />
      <WorkoutRecords workout={workout} />
      <SaveAsTemplate
        workoutId={workout.id}
        defaultName={
          workout.title || `Workout ${formatDayWithYear(workout.date)}`
        }
      />
      <Button onClick={() => void navigate('/', { replace: true })}>
        Done
      </Button>
    </Screen>
  )
}
