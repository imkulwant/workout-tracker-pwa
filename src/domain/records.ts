import { estimatedOneRepMaxKg, isMetricSet, setVolumeKg } from './metrics'
import type { LoadType, LocalDate, WorkoutSet } from './types'

export type RecordKind = 'heaviest' | 'e1rm' | 'setVolume' | 'mostReps'

export const RECORD_LABELS: Record<RecordKind, string> = {
  heaviest: 'Heaviest weight',
  e1rm: 'Best estimated 1RM',
  setVolume: 'Best set volume',
  mostReps: 'Most reps',
}

type SetLike = Pick<
  WorkoutSet,
  'weightKg' | 'reps' | 'completedAt' | 'type' | 'date'
>

/** The kinds tracked for an exercise. Most reps is for bodyweight exercises only. */
export function recordKindsFor(loadType: LoadType): RecordKind[] {
  return loadType === 'bodyweight_reps'
    ? ['heaviest', 'e1rm', 'setVolume', 'mostReps']
    : ['heaviest', 'e1rm', 'setVolume']
}

/** What one set scores for a record kind, or null if it cannot take part. */
export function recordValue(set: SetLike, kind: RecordKind): number | null {
  switch (kind) {
    case 'heaviest':
      return set.weightKg !== null && set.weightKg > 0 ? set.weightKg : null
    case 'e1rm':
      return estimatedOneRepMaxKg(set)
    case 'setVolume': {
      const volume = setVolumeKg(set)
      return volume > 0 ? volume : null
    }
    case 'mostReps':
      return set.reps
  }
}

const best = (sets: readonly SetLike[], kind: RecordKind) =>
  sets
    .filter(isMetricSet)
    .reduce<{ value: number; date: LocalDate } | null>((top, set) => {
      const value = recordValue(set, kind)
      if (value === null) return top
      return top === null || value > top.value ? { value, date: set.date } : top
    }, null)

export interface RecordBreak {
  kind: RecordKind
  value: number
  /** The best before this session. */
  previous: number
}

/**
 * The records a session broke. `earlier` is every countable set of the same
 * exercise from before the session. For a kind with nothing earlier to compare
 * with, the session only sets a baseline and breaks nothing. A tie is not a
 * record. Warm-ups never count.
 */
export function sessionRecords(
  earlier: readonly SetLike[],
  session: readonly SetLike[],
  loadType: LoadType,
): RecordBreak[] {
  return recordKindsFor(loadType).flatMap((kind): RecordBreak[] => {
    const before = best(earlier, kind)
    const now = best(session, kind)
    if (before === null || now === null || now.value <= before.value) return []
    return [{ kind, value: now.value, previous: before.value }]
  })
}

export type PersonalBests = Partial<
  Record<RecordKind, { value: number; date: LocalDate }>
>

/** The best of every kind over all the given sets, with the date it was set. */
export function personalBests(
  sets: readonly SetLike[],
  loadType: LoadType,
): PersonalBests {
  const bests: PersonalBests = {}
  for (const kind of recordKindsFor(loadType)) {
    const top = best(sets, kind)
    if (top) bests[kind] = top
  }
  return bests
}
