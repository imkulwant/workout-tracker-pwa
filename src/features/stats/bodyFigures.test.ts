import { describe, expect, it } from 'vitest'
import { MUSCLE_IDS } from '../../domain/muscles'
import { BACK, FRONT } from './bodyFigures'

describe('body figures', () => {
  it('cover all 18 muscles between the front and the back', () => {
    const drawn = new Set([...FRONT, ...BACK].map((region) => region.muscle))
    expect([...drawn].sort()).toEqual([...MUSCLE_IDS].sort())
    expect(MUSCLE_IDS).toHaveLength(18)
  })

  it('never draw a muscle twice on the same figure', () => {
    for (const figure of [FRONT, BACK]) {
      const names = figure.map((region) => region.muscle)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('keep every point inside the 100 x 200 grid, on the left half', () => {
    for (const region of [...FRONT, ...BACK]) {
      const numbers = region.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      expect(numbers.length).toBeGreaterThan(5)
      const xs = numbers.filter((_, i) => i % 2 === 0)
      const ys = numbers.filter((_, i) => i % 2 === 1)
      expect(Math.min(...xs), region.muscle).toBeGreaterThanOrEqual(0)
      expect(Math.max(...xs), region.muscle).toBeLessThanOrEqual(50)
      expect(Math.min(...ys), region.muscle).toBeGreaterThanOrEqual(0)
      expect(Math.max(...ys), region.muscle).toBeLessThanOrEqual(200)
    }
  })
})
