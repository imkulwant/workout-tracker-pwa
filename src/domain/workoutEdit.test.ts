import { describe, expect, it } from 'vitest'
import { at } from '../test/fixtures'
import { fromDateAndTime, readWorkoutTimes, toTimeOfDay } from './workoutEdit'

describe('toTimeOfDay', () => {
  it('shows the local time with two digits', () => {
    expect(toTimeOfDay(at(2026, 11, 9, 7, 5))).toBe('07:05')
    expect(toTimeOfDay(at(2026, 11, 9, 23, 59))).toBe('23:59')
    expect(toTimeOfDay(at(2026, 11, 9, 0, 0))).toBe('00:00')
  })
})

describe('fromDateAndTime', () => {
  it('is the inverse of toTimeOfDay on the same day', () => {
    expect(fromDateAndTime('2026-11-09', '18:30')).toBe(at(2026, 11, 9, 18, 30))
  })

  it.each([
    ['2026-13-01', '10:00'],
    ['not a date', '10:00'],
    ['2026-11-09', '24:00'],
    ['2026-11-09', '10:60'],
    ['2026-11-09', '9:00'],
    ['2026-11-09', ''],
  ])('rejects %s %s', (date, time) => {
    expect(fromDateAndTime(date, time)).toBeNull()
  })
})

describe('readWorkoutTimes', () => {
  const valid = { date: '2026-11-09', start: '18:00', end: '19:15' }

  it('turns a valid entry into instants on that date', () => {
    expect(readWorkoutTimes(valid)).toEqual({
      ok: true,
      date: '2026-11-09',
      startedAt: at(2026, 11, 9, 18, 0),
      endedAt: at(2026, 11, 9, 19, 15),
    })
  })

  it('asks for each missing part', () => {
    expect(readWorkoutTimes({ ...valid, date: '' })).toEqual({
      ok: false,
      error: 'Enter a date.',
    })
    expect(readWorkoutTimes({ ...valid, start: '' })).toEqual({
      ok: false,
      error: 'Enter a start time.',
    })
    expect(readWorkoutTimes({ ...valid, end: '' })).toEqual({
      ok: false,
      error: 'Enter an end time.',
    })
  })

  it('refuses an end at or before the start', () => {
    const error = { ok: false, error: 'The end must be after the start.' }
    expect(readWorkoutTimes({ ...valid, end: '18:00' })).toEqual(error)
    expect(readWorkoutTimes({ ...valid, end: '17:59' })).toEqual(error)
  })
})
