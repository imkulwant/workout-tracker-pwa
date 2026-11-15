export interface SetValues {
  weightKg: number | null
  reps: number | null
}

/**
 * The values a new set row starts with, in the plan's order: the same position
 * in the last completed session of this exercise, then the previous row of
 * this workout, then empty.
 *
 * `previous` is that last session's completed sets, in order, so position 0 is
 * its first completed set.
 */
export function prefillForNewSet(options: {
  position: number
  previous: readonly SetValues[]
  current: readonly SetValues[]
}): SetValues {
  const fromSession = options.previous[options.position]
  if (fromSession) {
    return { weightKg: fromSession.weightKg, reps: fromSession.reps }
  }
  const previousRow = options.current[options.current.length - 1]
  if (previousRow) {
    return { weightKg: previousRow.weightKg, reps: previousRow.reps }
  }
  return { weightKg: null, reps: null }
}
