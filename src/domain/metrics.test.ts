import { describe, expect, it } from 'vitest'
import {
  countMetricSets,
  isMetricSet,
  muscleSetCounts,
  setVolumeKg,
  totalVolumeKg,
  workoutDurationMs,
} from './metrics'
import type { Exercise, SetType } from './types'

const set = (
  weightKg: number | null,
  reps: number | null,
  options: { done?: boolean; type?: SetType; exerciseId?: string } = {},
) => ({
  weightKg,
  reps,
  completedAt: options.done === false ? null : 1,
  type: options.type ?? ('working' as SetType),
  exerciseId: options.exerciseId ?? 'bench',
})

describe('isMetricSet', () => {
  it('counts ticked sets of every type except warm-ups', () => {
    expect(isMetricSet(set(80, 5))).toBe(true)
    expect(isMetricSet(set(80, 5, { type: 'drop' }))).toBe(true)
    expect(isMetricSet(set(80, 5, { type: 'failure' }))).toBe(true)
    expect(isMetricSet(set(80, 5, { type: 'warmup' }))).toBe(false)
  })

  it('never counts a set that was not ticked', () => {
    expect(isMetricSet(set(80, 5, { done: false }))).toBe(false)
    expect(isMetricSet(set(80, 5, { done: false, type: 'warmup' }))).toBe(false)
  })
})

describe('volume', () => {
  it('is weight times reps', () => {
    expect(setVolumeKg(set(82.5, 5))).toBe(412.5)
    expect(setVolumeKg(set(100, 1))).toBe(100)
  })

  it('counts a missing weight as 0 and a missing reps as 0', () => {
    expect(setVolumeKg(set(null, 12))).toBe(0)
    expect(setVolumeKg(set(60, null))).toBe(0)
  })

  it('adds up ticked non-warm-up sets only', () => {
    const sets = [
      set(100, 5), // 500
      set(100, 5), // 500
      set(60, 10, { type: 'warmup' }), // excluded: warm-up
      set(100, 5, { done: false }), // excluded: not ticked
      set(null, 12), // 0: bodyweight with no added load
      set(20, 8, { type: 'drop' }), // 160
    ]

    expect(totalVolumeKg(sets)).toBe(1160)
    expect(countMetricSets(sets)).toBe(4)
  })

  it('is zero for no sets', () => {
    expect(totalVolumeKg([])).toBe(0)
    expect(countMetricSets([])).toBe(0)
  })
})

describe('muscleSetCounts', () => {
  const exercises = new Map<
    string,
    Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>
  >([
    [
      'bench',
      {
        primaryMuscles: ['chest'],
        secondaryMuscles: ['front_delts', 'triceps'],
      },
    ],
    [
      'dip',
      {
        primaryMuscles: ['chest', 'triceps'],
        secondaryMuscles: ['front_delts'],
      },
    ],
    ['curl', { primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'] }],
  ])

  it('gives each primary muscle 1 and each secondary muscle 0.5 per set', () => {
    const counts = muscleSetCounts(
      [set(80, 5), set(80, 5), set(80, 5)],
      exercises,
    )

    expect(counts).toEqual([
      ['chest', 3],
      ['front_delts', 1.5],
      ['triceps', 1.5],
    ])
  })

  it('adds the same muscle across exercises', () => {
    const counts = muscleSetCounts(
      [
        set(80, 5, { exerciseId: 'bench' }), // chest 1, front_delts 0.5, triceps 0.5
        set(0, 8, { exerciseId: 'dip' }), // chest 1, triceps 1, front_delts 0.5
      ],
      exercises,
    )

    expect(counts).toEqual([
      ['chest', 2],
      ['triceps', 1.5],
      ['front_delts', 1],
    ])
  })

  it('ignores warm-ups, unticked sets and exercises it does not know', () => {
    const counts = muscleSetCounts(
      [
        set(40, 10, { type: 'warmup' }),
        set(80, 5, { done: false }),
        set(30, 8, { exerciseId: 'unknown' }),
        set(20, 12, { exerciseId: 'curl' }),
      ],
      exercises,
    )

    expect(counts).toEqual([
      ['biceps', 1],
      ['forearms', 0.5],
    ])
  })

  it('lists the most worked first and keeps the plan muscle order on ties', () => {
    const counts = muscleSetCounts(
      [
        set(20, 12, { exerciseId: 'curl' }),
        set(80, 5, { exerciseId: 'bench' }),
      ],
      exercises,
    )

    // chest and biceps are both 1, and chest comes first in the muscle list.
    expect(counts.map(([muscle]) => muscle)).toEqual([
      'chest',
      'biceps',
      'front_delts',
      'triceps',
      'forearms',
    ])
  })

  it('returns nothing for no sets', () => {
    expect(muscleSetCounts([], exercises)).toEqual([])
  })
})

describe('workoutDurationMs', () => {
  it('is the end minus the start', () => {
    expect(workoutDurationMs({ startedAt: 1_000, endedAt: 61_000 })).toBe(
      60_000,
    )
  })

  it('runs an unfinished workout to now', () => {
    expect(workoutDurationMs({ startedAt: 1_000, endedAt: null }, 31_000)).toBe(
      30_000,
    )
  })

  it('is never negative', () => {
    expect(workoutDurationMs({ startedAt: 5_000, endedAt: 1_000 })).toBe(0)
  })
})
