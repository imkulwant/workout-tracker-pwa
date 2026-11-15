import { describe, expect, it } from 'vitest'
import { readSetEntry } from './setEntry'
import type { LoadType } from './types'

const read = (
  weightText: string,
  repsText: string,
  options: { loadType?: LoadType; forCompletion?: boolean } = {},
) =>
  readSetEntry({
    weightText,
    repsText,
    loadType: options.loadType ?? 'weight_reps',
    forCompletion: options.forCompletion ?? false,
  })

describe('readSetEntry while typing', () => {
  it('accepts a comma and a point as the same weight', () => {
    expect(read('82,5', '5')).toEqual({ ok: true, weightKg: 82.5, reps: 5 })
    expect(read('82.5', '5')).toEqual({ ok: true, weightKg: 82.5, reps: 5 })
  })

  it('treats blank fields as null, because the row is not finished', () => {
    expect(read('', '')).toEqual({ ok: true, weightKg: null, reps: null })
    expect(read('  ', ' ')).toEqual({ ok: true, weightKg: null, reps: null })
    expect(read('80', '')).toEqual({ ok: true, weightKg: 80, reps: null })
    expect(read('', '8')).toEqual({ ok: true, weightKg: null, reps: 8 })
  })

  it('rounds a weight to two decimals', () => {
    expect(read('20.125', '5')).toMatchObject({ weightKg: 20.13 })
    expect(read('82,456', '5')).toMatchObject({ weightKg: 82.46 })
  })

  it('accepts the limits: 0 to 1000 kg and 1 to 999 reps', () => {
    expect(read('0', '1')).toEqual({ ok: true, weightKg: 0, reps: 1 })
    expect(read('1000', '999')).toEqual({ ok: true, weightKg: 1000, reps: 999 })
  })

  it.each(['abc', '1,234.5', '1.2.3', '-5', '80kg'])(
    'rejects %j as a weight',
    (text) => {
      const result = read(text, '5')
      expect(result).toEqual({
        ok: false,
        errors: { weight: 'Enter a number, for example 82.5.' },
      })
    },
  )

  it.each(['1000.01', '1001', '99999'])(
    'rejects %j kg as out of range',
    (text) => {
      expect(read(text, '5')).toEqual({
        ok: false,
        errors: { weight: 'Weight must be from 0 to 1000 kg.' },
      })
    },
  )

  it.each(['0', '1000', '5.5', '5,5', 'abc', '-1'])(
    'rejects %j as reps',
    (text) => {
      expect(read('80', text)).toEqual({
        ok: false,
        errors: { reps: 'Reps must be a whole number from 1 to 999.' },
      })
    },
  )

  it('reports both fields at once', () => {
    const result = read('abc', '0')

    expect(result).toEqual({
      ok: false,
      errors: {
        weight: 'Enter a number, for example 82.5.',
        reps: 'Reps must be a whole number from 1 to 999.',
      },
    })
  })
})

describe('readSetEntry when the tick is tapped', () => {
  it('completes with both fields filled', () => {
    expect(read('80', '5', { forCompletion: true })).toEqual({
      ok: true,
      weightKg: 80,
      reps: 5,
    })
  })

  it('needs a weight for a weight-and-reps exercise', () => {
    expect(read('', '5', { forCompletion: true })).toEqual({
      ok: false,
      errors: { weight: 'Enter a weight to complete this set.' },
    })
  })

  it('needs reps for every exercise', () => {
    expect(read('80', '', { forCompletion: true })).toEqual({
      ok: false,
      errors: { reps: 'Enter reps to complete this set.' },
    })
    expect(
      read('', '', { loadType: 'bodyweight_reps', forCompletion: true }),
    ).toEqual({
      ok: false,
      errors: { reps: 'Enter reps to complete this set.' },
    })
  })

  it('reports an empty row as missing both on a weighted exercise', () => {
    expect(read('', '', { forCompletion: true })).toEqual({
      ok: false,
      errors: {
        weight: 'Enter a weight to complete this set.',
        reps: 'Enter reps to complete this set.',
      },
    })
  })

  it('lets a bodyweight exercise complete with no added weight', () => {
    expect(
      read('', '12', { loadType: 'bodyweight_reps', forCompletion: true }),
    ).toEqual({ ok: true, weightKg: null, reps: 12 })
    expect(
      read('10', '12', { loadType: 'bodyweight_reps', forCompletion: true }),
    ).toEqual({ ok: true, weightKg: 10, reps: 12 })
  })

  it('keeps the format error instead of replacing it with "required"', () => {
    expect(read('abc', '', { forCompletion: true })).toEqual({
      ok: false,
      errors: {
        weight: 'Enter a number, for example 82.5.',
        reps: 'Enter reps to complete this set.',
      },
    })
  })

  it('accepts a zero weight, which is a real value and not a blank', () => {
    expect(read('0', '8', { forCompletion: true })).toEqual({
      ok: true,
      weightKg: 0,
      reps: 8,
    })
  })
})
