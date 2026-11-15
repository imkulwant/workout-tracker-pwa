import { addDays, startOfWeek } from './dates'
import { BODY_PARTS, BODY_PART_MUSCLES, MUSCLE_IDS } from './muscles'
import type {
  BodyPart,
  Exercise,
  Id,
  LocalDate,
  MuscleId,
  Workout,
  WorkoutSet,
} from './types'

// The definitions are the plan's "Metric and heatmap definitions". Phase 7
// adds estimated 1RM, streaks and the heatmap calculations to this file.

/**
 * A set that counts towards a metric: ticked, and not a warm-up. Callers that
 * need finished workouts only get their sets from `listCountableSets`.
 */
export function isMetricSet(
  set: Pick<WorkoutSet, 'completedAt' | 'type'>,
): boolean {
  return set.completedAt !== null && set.type !== 'warmup'
}

/** Weight times reps. A missing weight counts as 0, so bodyweight sets count only added load. */
export function setVolumeKg(
  set: Pick<WorkoutSet, 'weightKg' | 'reps'>,
): number {
  return (set.weightKg ?? 0) * (set.reps ?? 0)
}

export function totalVolumeKg(
  sets: readonly Pick<
    WorkoutSet,
    'weightKg' | 'reps' | 'completedAt' | 'type'
  >[],
): number {
  return sets
    .filter(isMetricSet)
    .reduce((sum, set) => sum + setVolumeKg(set), 0)
}

export function countMetricSets(
  sets: readonly Pick<WorkoutSet, 'completedAt' | 'type'>[],
): number {
  return sets.filter(isMetricSet).length
}

/**
 * Muscle sets: each metric set adds 1.0 to every primary muscle of its
 * exercise and 0.5 to every secondary one. Returns the muscles that got
 * anything, most worked first, ties in the plan's muscle order.
 */
export function muscleSetCounts(
  sets: readonly Pick<WorkoutSet, 'exerciseId' | 'completedAt' | 'type'>[],
  exercises: ReadonlyMap<
    Id,
    Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>
  >,
): [MuscleId, number][] {
  const totals = new Map<MuscleId, number>()
  for (const set of sets.filter(isMetricSet)) {
    const exercise = exercises.get(set.exerciseId)
    if (!exercise) continue
    for (const muscle of exercise.primaryMuscles) {
      totals.set(muscle, (totals.get(muscle) ?? 0) + 1)
    }
    for (const muscle of exercise.secondaryMuscles) {
      totals.set(muscle, (totals.get(muscle) ?? 0) + 0.5)
    }
  }
  return MUSCLE_IDS.flatMap((muscle): [MuscleId, number][] => {
    const total = totals.get(muscle)
    return total === undefined ? [] : [[muscle, total]]
  }).sort((a, b) => b[1] - a[1])
}

/** `endedAt` minus `startedAt`. Pauses are not tracked. An unfinished workout runs to `now`. */
export function workoutDurationMs(
  workout: Pick<Workout, 'startedAt' | 'endedAt'>,
  now: number = Date.now(),
): number {
  return Math.max(0, (workout.endedAt ?? now) - workout.startedAt)
}

/**
 * Estimated one-rep max (Epley). The weight itself for a single, and
 * `weight x (1 + reps / 30)` for 2 to 12 reps. Above 12 reps, with no weight,
 * or with no load at all, there is no estimate.
 */
export function estimatedOneRepMaxKg(
  set: Pick<WorkoutSet, 'weightKg' | 'reps'>,
): number | null {
  const { weightKg, reps } = set
  if (weightKg === null || reps === null) return null
  if (weightKg <= 0 || reps < 1 || reps > 12) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

/** The display rounding for an estimate: the nearest 0.5 kg. */
export const roundE1rmKg = (value: number): number => Math.round(value * 2) / 2

/**
 * Sets per body part. Each metric set adds, to a part, the highest
 * contribution among that part's muscles (1 for a primary muscle, 0.5 for a
 * secondary one), so a set never counts twice in one part.
 */
export function bodyPartSetCounts(
  sets: readonly Pick<WorkoutSet, 'exerciseId' | 'completedAt' | 'type'>[],
  exercises: ReadonlyMap<
    Id,
    Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>
  >,
): Record<BodyPart, number> {
  const totals = Object.fromEntries(
    BODY_PARTS.map((part) => [part, 0]),
  ) as Record<BodyPart, number>
  for (const set of sets.filter(isMetricSet)) {
    const exercise = exercises.get(set.exerciseId)
    if (!exercise) continue
    for (const part of BODY_PARTS) {
      let best = 0
      for (const muscle of BODY_PART_MUSCLES[part]) {
        if (exercise.primaryMuscles.includes(muscle)) best = 1
        else if (exercise.secondaryMuscles.includes(muscle)) {
          best = Math.max(best, 0.5)
        }
      }
      totals[part] += best
    }
  }
  return totals
}

/**
 * Consecutive Monday-to-Sunday weeks with at least one completed workout,
 * ending at the current week, or at the previous one if this week has no
 * workout yet. `dates` are the dates of completed workouts.
 */
export function weeklyStreak(
  dates: Iterable<LocalDate>,
  today: LocalDate,
): number {
  const weeks = new Set([...dates].map(startOfWeek))
  const current = startOfWeek(today)
  let week = weeks.has(current) ? current : addDays(current, -7)
  let streak = 0
  while (weeks.has(week)) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}
