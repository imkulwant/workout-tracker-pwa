import { isMuscleId } from './muscles'
import type { MuscleId } from './types'

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
  if (overlap) return `${overlap} cannot be both primary and secondary.`
  return null
}
