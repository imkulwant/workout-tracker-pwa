import { MUSCLE_LABELS, bodyPartOf, isMuscleId } from './muscles'
import type { BodyPart, Equipment, Exercise, LoadType, MuscleId } from './types'

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
}

export const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  weight_reps: 'Weight and reps',
  bodyweight_reps: 'Bodyweight reps',
}

export const LOAD_TYPES = Object.keys(LOAD_TYPE_LABELS) as LoadType[]

/** Lower-case and trimmed, for search and uniqueness. */
export function toNameKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Checks the muscle rules for an exercise: at least one primary muscle, only
 * known muscle ids, no repeats, and no muscle both primary and secondary.
 * Returns a message describing the first problem, or null when valid.
 */
export function findMuscleProblem(
  primary: readonly MuscleId[],
  secondary: readonly MuscleId[],
): string | null {
  if (primary.length === 0) {
    return 'An exercise needs at least one primary muscle.'
  }
  for (const muscle of [...primary, ...secondary]) {
    if (!isMuscleId(muscle)) return `Unknown muscle: ${muscle}`
  }
  if (new Set(primary).size !== primary.length) {
    return 'A primary muscle is listed twice.'
  }
  if (new Set(secondary).size !== secondary.length) {
    return 'A secondary muscle is listed twice.'
  }
  const overlap = primary.find((muscle) => secondary.includes(muscle))
  if (overlap) {
    return `${MUSCLE_LABELS[overlap]} cannot be both primary and secondary.`
  }
  return null
}

export interface ExerciseFilter {
  /** Matches names containing every word, in any order, ignoring case. */
  query?: string
  /** Keeps exercises with a primary muscle in this body part. */
  bodyPart?: BodyPart | null
}

/** Filters a list for the library and the picker, keeping its order. */
export function filterExercises<
  T extends Pick<Exercise, 'nameKey' | 'primaryMuscles'>,
>(exercises: readonly T[], filter: ExerciseFilter): T[] {
  const words = toNameKey(filter.query ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const { bodyPart } = filter
  return exercises.filter(
    (exercise) =>
      words.every((word) => exercise.nameKey.includes(word)) &&
      (!bodyPart ||
        exercise.primaryMuscles.some(
          (muscle) => bodyPartOf(muscle) === bodyPart,
        )),
  )
}
