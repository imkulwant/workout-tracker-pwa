import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatDay,
  formatDayWithYear,
  formatDurationShort,
  formatPreviousSet,
  formatVolumeKg,
  formatWeightKg,
} from './format'

describe('formatWeightKg', () => {
  it.each([
    [82.5, '82.5'],
    [80, '80'],
    [0, '0'],
    [20.125, '20.13'],
    [82.456, '82.46'],
    [100.1, '100.1'],
  ])('shows %d as %j', (kg, text) => {
    expect(formatWeightKg(kg)).toBe(text)
  })

  it('shows a missing weight as nothing', () => {
    expect(formatWeightKg(null)).toBe('')
  })
})

describe('formatPreviousSet', () => {
  it.each([
    [{ weightKg: 80, reps: 5 }, '80 × 5'],
    [{ weightKg: 82.5, reps: 8 }, '82.5 × 8'],
    [{ weightKg: 0, reps: 10 }, '0 × 10'],
    [{ weightKg: null, reps: 12 }, '12 reps'],
    [{ weightKg: 60, reps: null }, '60 × –'],
    [{ weightKg: null, reps: null }, '–'],
  ])('shows %j as %j', (set, text) => {
    expect(formatPreviousSet(set)).toBe(text)
  })
})

describe('formatVolumeKg', () => {
  it.each([
    [0, '0'],
    [412.5, '413'],
    [999.4, '999'],
    [1000, '1,000'],
    [12345.6, '12,346'],
    [1234567, '1,234,567'],
  ])('shows %d as %j', (kg, text) => {
    expect(formatVolumeKg(kg)).toBe(text)
  })
})

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1_000, '0:01'],
    [59_000, '0:59'],
    [61_000, '1:01'],
    [600_000, '10:00'],
    [3_599_000, '59:59'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
    [36_000_000, '10:00:00'],
  ])('shows %d ms as %j', (ms, text) => {
    expect(formatClock(ms)).toBe(text)
  })

  it('never shows a negative time', () => {
    expect(formatClock(-5_000)).toBe('0:00')
  })
})

describe('formatDurationShort', () => {
  it.each([
    [0, '0 min'],
    [59_999, '0 min'],
    [60_000, '1 min'],
    [42 * 60_000 + 30_000, '42 min'],
    [3_600_000, '1 h 00 min'],
    [65 * 60_000, '1 h 05 min'],
    [72 * 60_000, '1 h 12 min'],
    [10 * 3_600_000 + 9 * 60_000, '10 h 09 min'],
  ])('shows %d ms as %j', (ms, text) => {
    expect(formatDurationShort(ms)).toBe(text)
  })

  it('never shows a negative time', () => {
    expect(formatDurationShort(-1)).toBe('0 min')
  })
})

describe('formatDay', () => {
  it('shows the weekday, day and month', () => {
    expect(formatDay('2026-11-09')).toBe('Mon 9 Nov')
    expect(formatDay('2026-11-08')).toBe('Sun 8 Nov')
    expect(formatDay('2026-01-31')).toBe('Sat 31 Jan')
  })
})

describe('formatDayWithYear', () => {
  it('shows the day, month and year', () => {
    expect(formatDayWithYear('2026-11-09')).toBe('9 Nov 2026')
    expect(formatDayWithYear('2025-12-31')).toBe('31 Dec 2025')
  })
})
