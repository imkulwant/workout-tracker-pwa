import { describe, expect, it } from 'vitest'
import {
  clamp,
  isValidReps,
  isValidWeightKg,
  parseDecimal,
  roundTo,
  roundWeightKg,
} from './numbers'

describe('parseDecimal', () => {
  it('stores a comma and a point as the same value', () => {
    expect(parseDecimal('82,5')).toBe(82.5)
    expect(parseDecimal('82.5')).toBe(82.5)
    expect(parseDecimal('82,5')).toBe(parseDecimal('82.5'))
  })

  it.each([
    ['82', 82],
    ['0', 0],
    ['  60,25  ', 60.25],
    ['007', 7],
    [',5', 0.5],
    ['.5', 0.5],
    ['82,', 82],
    ['82.', 82],
  ])('accepts %j as %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['82kg'],
    ['-5'],
    ['+5'],
    ['1e3'],
    ['1,234.5'],
    ['1.2.3'],
    ['1,2,3'],
    ['1 000'],
    ['NaN'],
    ['Infinity'],
    [','],
    ['.'],
  ])('rejects %j', (input) => {
    expect(parseDecimal(input)).toBeNull()
  })
})

describe('clamp', () => {
  it('limits a value to the range', () => {
    expect(clamp(5, 1, 10)).toBe(5)
    expect(clamp(-3, 0, 1000)).toBe(0)
    expect(clamp(1500, 0, 1000)).toBe(1000)
    expect(clamp(0, 0, 1000)).toBe(0)
    expect(clamp(1000, 0, 1000)).toBe(1000)
  })
})

describe('rounding', () => {
  it('rounds to the requested decimals', () => {
    expect(roundTo(82.456, 2)).toBe(82.46)
    expect(roundTo(82.454, 2)).toBe(82.45)
    expect(roundTo(2.5, 0)).toBe(3)
    expect(roundTo(-0.4, 0)).toBe(-0)
  })

  it('rounds halves up despite binary floating point', () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(0.285, 2)).toBe(0.29)
    expect(roundWeightKg(20.125)).toBe(20.13)
  })

  it('leaves values that already fit unchanged', () => {
    expect(roundWeightKg(82.5)).toBe(82.5)
    expect(roundWeightKg(100)).toBe(100)
  })
})

describe('plan limits', () => {
  it('accepts reps that are whole numbers from 1 to 999', () => {
    expect(isValidReps(1)).toBe(true)
    expect(isValidReps(999)).toBe(true)
    expect(isValidReps(0)).toBe(false)
    expect(isValidReps(1000)).toBe(false)
    expect(isValidReps(5.5)).toBe(false)
    expect(isValidReps(-1)).toBe(false)
    expect(isValidReps(Number.NaN)).toBe(false)
  })

  it('accepts weights from 0 to 1000 kg', () => {
    expect(isValidWeightKg(0)).toBe(true)
    expect(isValidWeightKg(1000)).toBe(true)
    expect(isValidWeightKg(82.5)).toBe(true)
    expect(isValidWeightKg(-0.01)).toBe(false)
    expect(isValidWeightKg(1000.01)).toBe(false)
    expect(isValidWeightKg(Number.NaN)).toBe(false)
    expect(isValidWeightKg(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
