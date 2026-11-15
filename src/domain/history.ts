import { startOfWeek } from './dates'
import { countMetricSets, totalVolumeKg } from './metrics'
import { BODY_PARTS, bodyPartOf } from './muscles'
import type {
  BodyPart,
  Exercise,
  Id,
  LocalDate,
  Workout,
  WorkoutSet,
} from './types'

export interface HistoryEntry {
  workout: Workout
  /** Ticked sets that are not warm-ups. */
  setCount: number
  volumeKg: number
  /** Body parts of the primary muscles of the exercises done, in a fixed order. */
  bodyParts: BodyPart[]
}

export interface WeekGroup {
  /** The Monday of the week. */
  weekStart: LocalDate
  entries: HistoryEntry[]
}

/** The totals shown for one workout in the list. */
export function summariseWorkout(
  workout: Workout,
  sets: readonly WorkoutSet[],
  exercises: ReadonlyMap<Id, Pick<Exercise, 'primaryMuscles'>>,
): HistoryEntry {
  const counted = sets.filter(
    (set) => set.completedAt !== null && set.type !== 'warmup',
  )
  const parts = new Set<BodyPart>()
  for (const set of counted) {
    for (const muscle of exercises.get(set.exerciseId)?.primaryMuscles ?? []) {
      parts.add(bodyPartOf(muscle))
    }
  }
  return {
    workout,
    setCount: countMetricSets(sets),
    volumeKg: totalVolumeKg(sets),
    bodyParts: BODY_PARTS.filter((part) => parts.has(part)),
  }
}

/**
 * Groups entries by the Monday-start week of their date. Weeks and the entries
 * inside them are newest first, and weeks with no workout are left out.
 */
export function groupByWeek(entries: readonly HistoryEntry[]): WeekGroup[] {
  const weeks = new Map<LocalDate, HistoryEntry[]>()
  for (const entry of entries) {
    const weekStart = startOfWeek(entry.workout.date)
    weeks.set(weekStart, [...(weeks.get(weekStart) ?? []), entry])
  }
  return [...weeks.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([weekStart, list]) => ({
      weekStart,
      entries: [...list].sort(
        (a, b) =>
          b.workout.date.localeCompare(a.workout.date) ||
          b.workout.startedAt - a.workout.startedAt,
      ),
    }))
}
