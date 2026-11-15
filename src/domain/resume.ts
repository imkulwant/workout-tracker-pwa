import type { EpochMs, Workout, WorkoutSet } from './types'

/** A workout still active this long after it started is probably forgotten. */
export const STALE_WORKOUT_MS = 12 * 60 * 60 * 1000

export function isStaleWorkout(
  workout: Pick<Workout, 'startedAt'>,
  now: EpochMs,
): boolean {
  return now - workout.startedAt > STALE_WORKOUT_MS
}

/** When the last set was ticked, or null if none was. */
export function lastCompletedAt(
  sets: readonly Pick<WorkoutSet, 'completedAt'>[],
): EpochMs | null {
  let latest: EpochMs | null = null
  for (const { completedAt } of sets) {
    if (completedAt !== null && (latest === null || completedAt > latest)) {
      latest = completedAt
    }
  }
  return latest
}
