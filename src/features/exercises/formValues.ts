import type { ExerciseInput } from '../../data/repositories/exercises'
import { findMuscleProblem } from '../../domain/exercises'
import { parseDecimal } from '../../domain/numbers'
import type {
  Equipment,
  Exercise,
  LoadType,
  MuscleId,
} from '../../domain/types'

/** What the exercise form holds while you edit: text stays text until saved. */
export interface ExerciseFormValues {
  name: string
  equipment: Equipment
  loadType: LoadType
  primary: MuscleId[]
  secondary: MuscleId[]
  restSec: string
  incrementKg: string
  notes: string
}

export interface ExerciseFormErrors {
  name?: string
  muscles?: string
  restSec?: string
  incrementKg?: string
}

export const DEFAULT_INCREMENT_TEXT = '2.5'

export function blankValues(name = ''): ExerciseFormValues {
  return {
    name,
    equipment: 'barbell',
    loadType: 'weight_reps',
    primary: [],
    secondary: [],
    restSec: '',
    incrementKg: DEFAULT_INCREMENT_TEXT,
    notes: '',
  }
}

export function valuesFromExercise(exercise: Exercise): ExerciseFormValues {
  return {
    name: exercise.name,
    equipment: exercise.equipment,
    loadType: exercise.loadType,
    primary: [...exercise.primaryMuscles],
    secondary: [...exercise.secondaryMuscles],
    restSec:
      exercise.defaultRestSec === null ? '' : String(exercise.defaultRestSec),
    incrementKg: String(exercise.incrementKg),
    notes: exercise.notes,
  }
}

export type FormResult =
  { ok: true; input: ExerciseInput } | { ok: false; errors: ExerciseFormErrors }

/**
 * Checks the form the way the repository will, so every problem can be shown
 * next to its field at once. Rest and increment accept a comma or a point.
 */
export function toExerciseInput(values: ExerciseFormValues): FormResult {
  const errors: ExerciseFormErrors = {}

  const name = values.name.trim()
  if (name === '') errors.name = 'Enter a name.'

  const muscleProblem = findMuscleProblem(values.primary, values.secondary)
  if (muscleProblem) errors.muscles = muscleProblem

  let defaultRestSec: number | null = null
  if (values.restSec.trim() !== '') {
    const rest = parseDecimal(values.restSec)
    if (rest === null || !Number.isInteger(rest)) {
      errors.restSec = 'Enter whole seconds, for example 90, or leave it empty.'
    } else {
      defaultRestSec = rest
    }
  }

  const increment = parseDecimal(values.incrementKg)
  if (increment === null || increment <= 0) {
    errors.incrementKg = 'Enter a number above 0, for example 2.5.'
  }

  if (Object.keys(errors).length > 0 || increment === null) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    input: {
      name,
      equipment: values.equipment,
      loadType: values.loadType,
      primaryMuscles: values.primary,
      secondaryMuscles: values.secondary,
      notes: values.notes.trim(),
      defaultRestSec,
      incrementKg: increment,
    },
  }
}
