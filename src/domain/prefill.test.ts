import { describe, expect, it } from 'vitest'
import { prefillForNewSet } from './prefill'

const v = (weightKg: number | null, reps: number | null) => ({ weightKg, reps })

describe('prefillForNewSet', () => {
  it('starts empty with no history and no earlier row', () => {
    expect(
      prefillForNewSet({ position: 0, previous: [], current: [] }),
    ).toEqual(v(null, null))
  })

  it('uses the same position in the last session first', () => {
    const previous = [v(80, 5), v(85, 5), v(90, 3)]

    expect(prefillForNewSet({ position: 0, previous, current: [] })).toEqual(
      v(80, 5),
    )
    expect(
      prefillForNewSet({ position: 1, previous, current: [v(80, 5)] }),
    ).toEqual(v(85, 5))
    expect(
      prefillForNewSet({
        position: 2,
        previous,
        current: [v(80, 5), v(85, 5)],
      }),
    ).toEqual(v(90, 3))
  })

  it('prefers the last session over the row above, when it has that position', () => {
    // The row above says 60 × 10, but last time the second set was 85 × 5.
    expect(
      prefillForNewSet({
        position: 1,
        previous: [v(80, 5), v(85, 5)],
        current: [v(60, 10)],
      }),
    ).toEqual(v(85, 5))
  })

  it('falls back to the previous row once past the last session', () => {
    expect(
      prefillForNewSet({
        position: 3,
        previous: [v(80, 5), v(85, 5)],
        current: [v(80, 5), v(85, 5), v(90, 4)],
      }),
    ).toEqual(v(90, 4))
  })

  it('copies the previous row when there is no history at all', () => {
    expect(
      prefillForNewSet({ position: 1, previous: [], current: [v(82.5, 6)] }),
    ).toEqual(v(82.5, 6))
  })

  it('copies the last row, not an earlier one', () => {
    expect(
      prefillForNewSet({
        position: 2,
        previous: [],
        current: [v(60, 10), v(70, 8)],
      }),
    ).toEqual(v(70, 8))
  })

  it('carries a blank field through as null', () => {
    expect(
      prefillForNewSet({ position: 0, previous: [v(null, 12)], current: [] }),
    ).toEqual(v(null, 12))
    expect(
      prefillForNewSet({ position: 1, previous: [], current: [v(40, null)] }),
    ).toEqual(v(40, null))
  })

  it('returns a copy, so editing the new row cannot change the old one', () => {
    const previous = [v(80, 5)]

    const result = prefillForNewSet({ position: 0, previous, current: [] })
    result.weightKg = 999

    expect(previous[0]!.weightKg).toBe(80)
  })
})
