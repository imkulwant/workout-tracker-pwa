import {
  MAX_REPS,
  MAX_WEIGHT_KG,
  MIN_REPS,
  MIN_WEIGHT_KG,
  isValidReps,
  isValidWeightKg,
  parseDecimal,
  roundWeightKg,
} from './numbers'
import type { LoadType } from './types'

export interface SetEntryErrors {
  weight?: string
  reps?: string
}

export type SetEntryResult =
  | { ok: true; weightKg: number | null; reps: number | null }
  | { ok: false; errors: SetEntryErrors }

/**
 * Reads the two fields of a set row. A blank field is fine while you are still
 * typing, so it becomes null. Both a comma and a point work as the decimal
 * separator. When `forCompletion` is set, which is when the tick is tapped,
 * reps are required for every exercise and a weight for weight-and-reps ones,
 * and nothing is accepted until both are there.
 */
export function readSetEntry(input: {
  weightText: string
  repsText: string
  loadType: LoadType
  forCompletion: boolean
}): SetEntryResult {
  const errors: SetEntryErrors = {}
  let weightKg: number | null = null
  let reps: number | null = null

  if (input.weightText.trim() !== '') {
    const weight = parseDecimal(input.weightText)
    if (weight === null) {
      errors.weight = 'Enter a number, for example 82.5.'
    } else if (!isValidWeightKg(weight)) {
      errors.weight = `Weight must be from ${MIN_WEIGHT_KG} to ${MAX_WEIGHT_KG} kg.`
    } else {
      weightKg = roundWeightKg(weight)
    }
  }

  if (input.repsText.trim() !== '') {
    const parsed = parseDecimal(input.repsText)
    if (parsed === null || !isValidReps(parsed)) {
      errors.reps = `Reps must be a whole number from ${MIN_REPS} to ${MAX_REPS}.`
    } else {
      reps = parsed
    }
  }

  if (input.forCompletion) {
    if (
      !errors.weight &&
      weightKg === null &&
      input.loadType === 'weight_reps'
    ) {
      errors.weight = 'Enter a weight to complete this set.'
    }
    if (!errors.reps && reps === null) {
      errors.reps = 'Enter reps to complete this set.'
    }
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, weightKg, reps }
}
