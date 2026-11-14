import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  eachDate,
  eachWeekStart,
  isLocalDate,
  startOfWeek,
  toLocalDate,
  weekdayIndex,
} from './dates'

// Month is 1-based here, to read like the dates in the plan.
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

describe('test environment', () => {
  it('runs in Europe/Stockholm', () => {
    // getTimezoneOffset is minutes behind UTC: CET is -60, CEST is -120.
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(-60)
    expect(new Date(2026, 6, 15, 12).getTimezoneOffset()).toBe(-120)
  })
})

describe('toLocalDate', () => {
  it('uses the local calendar day, not the UTC day', () => {
    // 00:30 CEST on 1 July is 22:30 UTC on 30 June.
    const instant = at(2026, 7, 1, 0, 30)
    expect(new Date(instant).toISOString().slice(0, 10)).toBe('2026-06-30')
    expect(toLocalDate(instant)).toBe('2026-07-01')
  })

  it('assigns a session that crosses midnight to the day it started', () => {
    const startedAt = at(2026, 10, 24, 23, 50)
    const endedAt = at(2026, 10, 25, 0, 40)
    expect(toLocalDate(startedAt)).toBe('2026-10-24')
    expect(toLocalDate(endedAt)).toBe('2026-10-25')
  })

  it('handles the 23-hour day when clocks go forward on 29 March 2026', () => {
    expect(toLocalDate(at(2026, 3, 29, 0, 0))).toBe('2026-03-29')
    expect(toLocalDate(at(2026, 3, 29, 1, 59))).toBe('2026-03-29')
    expect(toLocalDate(at(2026, 3, 29, 3, 0))).toBe('2026-03-29')
    expect(toLocalDate(at(2026, 3, 29, 23, 59))).toBe('2026-03-29')
  })

  it('handles the 25-hour day when clocks go back on 25 October 2026', () => {
    expect(toLocalDate(at(2026, 10, 25, 0, 30))).toBe('2026-10-25')
    expect(toLocalDate(at(2026, 10, 25, 23, 30))).toBe('2026-10-25')
    // 25 hours after local midnight is still before the next local midnight.
    expect(toLocalDate(at(2026, 10, 25, 0, 0) + 24 * 3_600_000)).toBe(
      '2026-10-25',
    )
  })

  it('zero-pads month and day', () => {
    expect(toLocalDate(at(2026, 1, 5, 12))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('steps across month, year and leap-day boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-05-10', 0)).toBe('2026-05-10')
  })

  it('never skips or repeats a date across either DST change', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('daysBetween', () => {
  it('counts whole days across DST changes', () => {
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1)
    expect(daysBetween('2026-03-23', '2026-03-30')).toBe(7)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-10-26', '2026-10-24')).toBe(-2)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })
})

describe('weeks start on Monday', () => {
  it('numbers weekdays with Monday as 0 and Sunday as 6', () => {
    expect(weekdayIndex('2026-03-30')).toBe(0) // Monday
    expect(weekdayIndex('2026-03-29')).toBe(6) // Sunday
    expect(weekdayIndex('2026-10-24')).toBe(5) // Saturday
  })

  it('finds the Monday of a week', () => {
    expect(startOfWeek('2026-03-30')).toBe('2026-03-30') // Monday itself
    expect(startOfWeek('2026-03-29')).toBe('2026-03-23') // Sunday of the DST week
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19') // Sunday of the DST week
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28') // across the year end
  })
})

describe('range iteration', () => {
  it('lists every date once across the spring DST change', () => {
    expect(eachDate('2026-03-27', '2026-03-31')).toEqual([
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ])
  })

  it('lists every date once across the autumn DST change', () => {
    expect(eachDate('2026-10-23', '2026-10-27')).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ])
  })

  it('returns one date for a single-day range and none for a reversed one', () => {
    expect(eachDate('2026-05-10', '2026-05-10')).toEqual(['2026-05-10'])
    expect(eachDate('2026-05-11', '2026-05-10')).toEqual([])
  })

  it('lists the Mondays of every overlapping week', () => {
    expect(eachWeekStart('2026-03-25', '2026-04-06')).toEqual([
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
    ])
    expect(eachWeekStart('2026-03-29', '2026-03-29')).toEqual(['2026-03-23'])
  })

  it('covers 53 weeks without a gap', () => {
    const weeks = eachWeekStart('2025-11-17', '2026-11-16')
    expect(weeks).toHaveLength(53)
    weeks.slice(1).forEach((week, i) => {
      expect(daysBetween(weeks[i]!, week)).toBe(7)
    })
  })
})

describe('isLocalDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isLocalDate('2026-03-29')).toBe(true)
    expect(isLocalDate('2028-02-29')).toBe(true)
    expect(isLocalDate('2026-02-29')).toBe(false)
    expect(isLocalDate('2026-02-30')).toBe(false)
    expect(isLocalDate('2026-13-01')).toBe(false)
    expect(isLocalDate('2026-3-29')).toBe(false)
    expect(isLocalDate('2026-03-29T10:00')).toBe(false)
    expect(isLocalDate('')).toBe(false)
  })

  it('makes arithmetic helpers throw on malformed input', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Invalid local date')
    expect(() => startOfWeek('yesterday')).toThrow('Invalid local date')
  })
})
