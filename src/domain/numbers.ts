export const MIN_REPS = 1
export const MAX_REPS = 999
export const MIN_WEIGHT_KG = 0
export const MAX_WEIGHT_KG = 1000
export const WEIGHT_DECIMALS = 2

// Digits with at most one separator, so "82,5", "82.5", "82" and ",5" parse
// but "1,234.5" and "1.2.3" do not.
const DECIMAL = /^(\d+[.,]?\d*|[.,]\d+)$/

/**
 * Parses what a person types into a number field. Accepts a comma or a point
 * as the decimal separator, because Swedish keyboards produce a comma.
 * Returns null for anything ambiguous or non-numeric.
 */
export function parseDecimal(input: string): number | null {
  const text = input.trim()
  if (!DECIMAL.test(text)) return null
  return Number(text.replace(',', '.'))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function roundWeightKg(value: number): number {
  return roundTo(value, WEIGHT_DECIMALS)
}

export function isValidReps(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_REPS && value <= MAX_REPS
}

export function isValidWeightKg(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MIN_WEIGHT_KG && value <= MAX_WEIGHT_KG
  )
}
