import { describe, expect, it } from 'vitest'
import { STALE_WORKOUT_MS, isStaleWorkout, lastCompletedAt } from './resume'

describe('isStaleWorkout', () => {
  const workout = { startedAt: 1_000_000 }

  it('is not stale at exactly 12 hours', () => {
    expect(isStaleWorkout(workout, 1_000_000 + STALE_WORKOUT_MS)).toBe(false)
  })

  it('is stale after 12 hours', () => {
    expect(isStaleWorkout(workout, 1_000_000 + STALE_WORKOUT_MS + 1)).toBe(true)
  })

  it('is not stale just after starting', () => {
    expect(isStaleWorkout(workout, 1_000_001)).toBe(false)
  })
})

describe('lastCompletedAt', () => {
  it('is null with no sets', () => {
    expect(lastCompletedAt([])).toBeNull()
  })

  it('is null when no set is ticked', () => {
    expect(lastCompletedAt([{ completedAt: null }])).toBeNull()
  })

  it('is the latest tick, whatever the order', () => {
    expect(
      lastCompletedAt([
        { completedAt: 300 },
        { completedAt: null },
        { completedAt: 500 },
        { completedAt: 400 },
      ]),
    ).toBe(500)
  })
})
