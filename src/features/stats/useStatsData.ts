import { useLiveQuery } from 'dexie-react-hooks'
import { listExercises } from '../../data/repositories/exercises'
import { listCountableSets } from '../../data/repositories/sets'
import { listCompletedWorkouts } from '../../data/repositories/workouts'
import { toLocalDate } from '../../domain/dates'
import { calendarWeeks } from '../../domain/heatmaps'
import type {
  Exercise,
  Id,
  LocalDate,
  Workout,
  WorkoutSet,
} from '../../domain/types'

export interface StatsData {
  today: LocalDate
  /** Countable sets from the first week the calendar shows. Warm-ups are in; metrics drop them. */
  sets: WorkoutSet[]
  /** Every completed workout, newest first. */
  workouts: Workout[]
  workoutsById: Map<Id, Workout>
  exercises: Map<Id, Exercise>
}

/** Everything the Stats tab draws from, read once and kept current. */
export function useStatsData(): StatsData | undefined {
  return useLiveQuery(async () => {
    const today = toLocalDate(Date.now())
    const fromDate = calendarWeeks(today)[0]!.weekStart
    const [sets, workouts, exercises] = await Promise.all([
      listCountableSets({ fromDate }),
      listCompletedWorkouts(Number.MAX_SAFE_INTEGER),
      listExercises({ includeArchived: true }),
    ])
    return {
      today,
      sets,
      workouts,
      workoutsById: new Map(workouts.map((w) => [w.id, w])),
      exercises: new Map(exercises.map((e) => [e.id, e])),
    }
  })
}
