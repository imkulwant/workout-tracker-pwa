import { describe, expect, it } from 'vitest'
import {
  personalBests,
  recordKindsFor,
  recordValue,
  sessionRecords,
} from './records'
import type { SetType, WorkoutSet } from './types'

const s = (
  weightKg: number | null,
  reps: number | null,
  date = '2026-11-01',
  type: SetType = 'working',
  done = true,
) =>
  ({
    weightKg,
    reps,
    date,
    type,
    completedAt: done ? 1 : null,
  }) as Pick<WorkoutSet, 'weightKg' | 'reps' | 'date' | 'type' | 'completedAt'>

// Earlier best: heaviest 100, e1RM 100 x (1 + 5/30) = 116.67, set volume 720.
const earlier = [s(100, 5), s(90, 8)]

describe('recordValue', () => {
  it('scores a set for each kind', () => {
    expect(recordValue(s(100, 5), 'heaviest')).toBe(100)
    expect(recordValue(s(100, 5), 'e1rm')).toBeCloseTo(116.6667, 4)
    expect(recordValue(s(100, 5), 'setVolume')).toBe(500)
    expect(recordValue(s(null, 12), 'mostReps')).toBe(12)
  })

  it('has no score for a set with no load, or no estimate', () => {
    expect(recordValue(s(null, 10), 'heaviest')).toBeNull()
    expect(recordValue(s(0, 10), 'heaviest')).toBeNull()
    expect(recordValue(s(null, 10), 'setVolume')).toBeNull()
    expect(recordValue(s(50, 13), 'e1rm')).toBeNull()
  })
})

describe('recordKindsFor', () => {
  it('tracks most reps for bodyweight exercises only', () => {
    expect(recordKindsFor('weight_reps')).toEqual([
      'heaviest',
      'e1rm',
      'setVolume',
    ])
    expect(recordKindsFor('bodyweight_reps')).toContain('mostReps')
  })
})

describe('sessionRecords', () => {
  it('reports only the kinds that were beaten', () => {
    // 105 x 3: heavier than 100, but e1RM 115.5 and volume 315 are lower.
    expect(sessionRecords(earlier, [s(105, 3)], 'weight_reps')).toEqual([
      { kind: 'heaviest', value: 105, previous: 100 },
    ])
  })

  it('reports several at once, with the values that were beaten', () => {
    // 90 x 9: volume 810 > 720, and e1RM 90 x 1.3 = 117 > 116.67.
    const result = sessionRecords(earlier, [s(90, 9)], 'weight_reps')
    expect(result.map((r) => r.kind)).toEqual(['e1rm', 'setVolume'])
    expect(result[0]!.value).toBeCloseTo(117, 10)
    expect(result[0]!.previous).toBeCloseTo(116.6667, 4)
    expect(result[1]).toEqual({ kind: 'setVolume', value: 810, previous: 720 })
  })

  it('uses the best set of the session', () => {
    expect(
      sessionRecords(
        earlier,
        [s(60, 5), s(110, 2), s(70, 5)],
        'weight_reps',
      ).map((r) => r.kind),
    ).toEqual(['heaviest', 'e1rm'])
  })

  it('does not celebrate a tie', () => {
    expect(sessionRecords(earlier, [s(100, 5)], 'weight_reps')).toEqual([])
  })

  it('sets a baseline, not a record, the first time an exercise is done', () => {
    expect(sessionRecords([], [s(200, 5)], 'weight_reps')).toEqual([])
  })

  it('does not compare a kind that has no earlier value', () => {
    // The earlier set had 15 reps, so there is no earlier e1RM to beat. The
    // new 60 x 5 beats its weight (50) but not its volume (300 against 750).
    expect(
      sessionRecords([s(50, 15)], [s(60, 5)], 'weight_reps').map((r) => r.kind),
    ).toEqual(['heaviest'])
  })

  it('ignores warm-ups and unticked sets, in the session and before it', () => {
    expect(
      sessionRecords(
        [
          s(300, 1, '2026-10-01', 'warmup'),
          s(300, 1, '2026-10-01', 'working', false),
          ...earlier,
        ],
        [
          s(200, 1, '2026-11-09', 'warmup'),
          s(400, 1, '2026-11-09', 'working', false),
        ],
        'weight_reps',
      ),
    ).toEqual([])
  })

  it('tracks most reps for bodyweight exercises, and the load only when there is one', () => {
    const earlierPullUps = [s(null, 10), s(null, 8)]
    expect(
      sessionRecords(earlierPullUps, [s(null, 12)], 'bodyweight_reps'),
    ).toEqual([{ kind: 'mostReps', value: 12, previous: 10 }])
    expect(
      sessionRecords(earlierPullUps, [s(null, 12)], 'weight_reps'),
    ).toEqual([])
    expect(
      sessionRecords(earlierPullUps, [s(10, 6)], 'bodyweight_reps'),
    ).toEqual([])
  })
})

describe('personalBests', () => {
  it('gives the best of each kind with the date it was set', () => {
    const bests = personalBests(
      [
        s(100, 5, '2026-09-01'),
        s(90, 8, '2026-10-01'),
        s(105, 1, '2026-11-01'),
      ],
      'weight_reps',
    )
    expect(bests.heaviest).toEqual({ value: 105, date: '2026-11-01' })
    expect(bests.e1rm!.value).toBeCloseTo(116.6667, 4)
    expect(bests.e1rm!.date).toBe('2026-09-01')
    expect(bests.setVolume).toEqual({ value: 720, date: '2026-10-01' })
    expect(bests.mostReps).toBeUndefined()
  })

  it('keeps the first date when a best is matched later', () => {
    expect(
      personalBests(
        [s(100, 5, '2026-09-01'), s(100, 5, '2026-10-01')],
        'weight_reps',
      ).heaviest,
    ).toEqual({ value: 100, date: '2026-09-01' })
  })

  it('is empty when nothing counts', () => {
    expect(personalBests([], 'weight_reps')).toEqual({})
    expect(
      personalBests([s(100, 5, '2026-09-01', 'warmup')], 'weight_reps'),
    ).toEqual({})
  })

  it('includes most reps for bodyweight exercises', () => {
    expect(
      personalBests(
        [s(null, 10, '2026-09-01'), s(null, 14, '2026-10-01')],
        'bodyweight_reps',
      ),
    ).toEqual({
      mostReps: { value: 14, date: '2026-10-01' },
    })
  })
})
