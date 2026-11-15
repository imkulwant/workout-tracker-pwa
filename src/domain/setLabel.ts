import type { SetType, WorkoutSet } from './types'

const BADGES: Record<Exclude<SetType, 'working'>, string> = {
  warmup: 'W',
  drop: 'D',
  failure: 'F',
}

export const SET_TYPE_LABELS: Record<SetType, string> = {
  working: 'Working set',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
}

/**
 * What the badge of each set row shows: working sets are numbered 1, 2, 3 and
 * the others show W, D or F, so a warm-up does not shift the numbering.
 */
export function setLabels(sets: readonly Pick<WorkoutSet, 'type'>[]): string[] {
  let working = 0
  return sets.map((set) =>
    set.type === 'working' ? String(++working) : BADGES[set.type],
  )
}
