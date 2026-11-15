import { MUSCLE_IDS } from './muscles'
import type { Exercise, Id, MuscleId, Workout, WorkoutSet } from './types'

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
