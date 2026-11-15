import { InvariantError } from '../../data/repositories/common'
import { getExercise } from '../../data/repositories/exercises'
import {
  addSet,
  getPreviousPerformance,
  listSets,
  listWorkoutSets,
} from '../../data/repositories/sets'
import {
  clearSetting,
  getSetting,
  setSetting,
} from '../../data/repositories/settings'
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  getWorkoutExercise,
} from '../../data/repositories/workouts'
import { prefillForNewSet } from '../../domain/prefill'
import { lastCompletedAt } from '../../domain/resume'
import { restSecondsFor, startRestTimer } from '../../domain/rest'
import type { Exercise, Id, WorkoutSet } from '../../domain/types'

/**
 * Adds a set to the end of an exercise. Its weight and reps come from the
 * plan's prefill order: the same position in the last session of this
 * exercise, then the row above, then empty. The values are stored, so a
 * prefilled set completes with one tap.
 */
export async function addSetToExercise(
  workoutExerciseId: Id,
): Promise<WorkoutSet> {
  const row = await getWorkoutExercise(workoutExerciseId)
  if (!row) throw new InvariantError('Exercise not found')

  const [current, previous] = await Promise.all([
    listSets(row.id),
    getPreviousPerformance(row.exerciseId, row.workoutId),
  ])
  const { weightKg, reps } = prefillForNewSet({
    position: current.length,
    previous,
    current,
  })
  return addSet(row.id, { weightKg, reps })
}

/** Adds exercises to a workout, in the order given, each with a first set. */
export async function addExercisesToWorkout(
  workoutId: Id,
  exercises: readonly Exercise[],
): Promise<void> {
  for (const exercise of exercises) {
    const row = await addExerciseToWorkout(workoutId, exercise.id)
    await addSetToExercise(row.id)
  }
}

/**
 * Starts the rest timer after a completed working set. Warm-up, drop and
 * failure sets do not start one. The length is the exercise's own rest, then
 * the global default. A new timer replaces any running one.
 */
export async function startRestAfterSet(
  set: WorkoutSet,
  now: number = Date.now(),
): Promise<void> {
  if (set.type !== 'working') return
  const [exercise, globalDefaultSec] = await Promise.all([
    getExercise(set.exerciseId),
    getSetting('defaultRestSec'),
  ])
  const seconds = restSecondsFor({
    exerciseRestSec: exercise?.defaultRestSec ?? null,
    globalDefaultSec,
  })
  if (seconds <= 0) return
  await setSetting(
    'activeRestTimer',
    startRestTimer(set.workoutExerciseId, seconds, now),
  )
}

/**
 * Finishes a forgotten workout at the time of its last completed set, so the
 * duration is not stretched by the hours it was left open. Returns false, and
 * changes nothing, when no set was completed.
 */
export async function finishAtLastSet(workoutId: Id): Promise<boolean> {
  const endedAt = lastCompletedAt(await listWorkoutSets(workoutId))
  if (endedAt === null) return false
  await finishWorkout(workoutId, endedAt)
  await clearSetting('activeRestTimer')
  return true
}

/** Deletes a workout in progress, and stops its rest timer. */
export async function discardWorkout(workoutId: Id): Promise<void> {
  await deleteWorkout(workoutId)
  await clearSetting('activeRestTimer')
}
