import { addDays } from './dates'
import { estimatedOneRepMaxKg, isMetricSet, setVolumeKg } from './metrics'
import type { Id, LocalDate, WorkoutSet } from './types'

export type ProgressMetric = 'e1rm' | 'weight' | 'volume'
export type ProgressRange = '3m' | '6m' | '1y' | 'all'

export const PROGRESS_RANGE_DAYS: Record<
  Exclude<ProgressRange, 'all'>,
  number
> = { '3m': 91, '6m': 182, '1y': 365 }

export interface ProgressPoint {
  date: LocalDate
  value: number
}

type SetLike = Pick<
  WorkoutSet,
  'workoutId' | 'date' | 'weightKg' | 'reps' | 'completedAt' | 'type'
>

/**
 * One point per session of an exercise: its best estimated 1RM, its heaviest
 * weight, or its total volume, oldest first. Sessions with nothing to show
 * for the chosen measure, such as a session of 15-rep sets for e1RM, are
 * skipped. The range ends today and includes it.
 */
export function progressSeries(
  sets: readonly SetLike[],
  metric: ProgressMetric,
  range: ProgressRange,
  today: LocalDate,
): ProgressPoint[] {
  const from =
    range === 'all' ? '' : addDays(today, -(PROGRESS_RANGE_DAYS[range] - 1))
  const sessions = new Map<Id, { date: LocalDate; value: number | null }>()
  for (const set of sets) {
    if (!isMetricSet(set) || set.date < from || set.date > today) continue
    const session = sessions.get(set.workoutId) ?? {
      date: set.date,
      value: null,
    }
    const value =
      metric === 'e1rm'
        ? estimatedOneRepMaxKg(set)
        : metric === 'weight'
          ? set.weightKg
          : setVolumeKg(set)
    if (value !== null) {
      session.value =
        session.value === null
          ? value
          : metric === 'volume'
            ? session.value + value
            : Math.max(session.value, value)
    }
    sessions.set(set.workoutId, session)
  }
  return [...sessions.values()]
    .flatMap((s): ProgressPoint[] =>
      s.value !== null && s.value > 0 ? [{ date: s.date, value: s.value }] : [],
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}
