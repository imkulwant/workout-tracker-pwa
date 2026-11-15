import type { EpochMs, Id } from './types'

/** The persisted rest timer: the setting `activeRestTimer`. */
export interface RestTimer {
  endsAt: EpochMs
  durationSec: number
  workoutExerciseId: Id
}

/** Rest after a working set: the template item's, then the exercise's, then the global default. */
export function restSecondsFor(options: {
  templateRestSec?: number | null
  exerciseRestSec: number | null
  globalDefaultSec: number
}): number {
  return (
    options.templateRestSec ??
    options.exerciseRestSec ??
    options.globalDefaultSec
  )
}

export function startRestTimer(
  workoutExerciseId: Id,
  durationSec: number,
  now: EpochMs,
): RestTimer {
  return { endsAt: now + durationSec * 1000, durationSec, workoutExerciseId }
}

/** Whole seconds left, rounded up so the display shows 0:01 until it is really done. */
export function remainingSeconds(timer: RestTimer, now: EpochMs): number {
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
}

export function isRestFinished(timer: RestTimer, now: EpochMs): boolean {
  return now >= timer.endsAt
}

/**
 * Moves the end by `deltaSec` (the bar's -15 s and +15 s). It cannot end before
 * now, so shortening a nearly done timer finishes it, and the duration never
 * drops below zero.
 */
export function adjustRestTimer(
  timer: RestTimer,
  deltaSec: number,
  now: EpochMs,
): RestTimer {
  return {
    ...timer,
    endsAt: Math.max(now, timer.endsAt + deltaSec * 1000),
    durationSec: Math.max(0, timer.durationSec + deltaSec),
  }
}
