import { InvariantError } from '../../data/repositories/common'
import {
  addSet,
  getPreviousPerformance,
  listSets,
} from '../../data/repositories/sets'
import {
  addExerciseToWorkout,
  getWorkoutExercise,
} from '../../data/repositories/workouts'
import { prefillForNewSet } from '../../domain/prefill'
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
