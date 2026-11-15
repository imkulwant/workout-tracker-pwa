import { describe, expect, it } from 'vitest'
import {
  adjustRestTimer,
  isRestFinished,
  remainingSeconds,
  restSecondsFor,
  startRestTimer,
} from './rest'

describe('restSecondsFor', () => {
  it('uses the template rest first, then the exercise rest, then the global default', () => {
    expect(
      restSecondsFor({
        templateRestSec: 45,
        exerciseRestSec: 90,
        globalDefaultSec: 120,
      }),
    ).toBe(45)
    expect(
      restSecondsFor({
        templateRestSec: null,
        exerciseRestSec: 90,
        globalDefaultSec: 120,
      }),
    ).toBe(90)
    expect(restSecondsFor({ exerciseRestSec: 90, globalDefaultSec: 120 })).toBe(
      90,
    )
    expect(
      restSecondsFor({
        templateRestSec: null,
        exerciseRestSec: null,
        globalDefaultSec: 120,
      }),
    ).toBe(120)
  })

  it('treats 0 as a real choice, not as missing', () => {
    expect(restSecondsFor({ exerciseRestSec: 0, globalDefaultSec: 120 })).toBe(
      0,
    )
    expect(
      restSecondsFor({
        templateRestSec: 0,
        exerciseRestSec: 90,
        globalDefaultSec: 120,
      }),
    ).toBe(0)
  })
})

describe('the timer', () => {
  const timer = startRestTimer('we-1', 90, 10_000)

  it('starts with the end derived from now and the duration', () => {
    expect(timer).toEqual({
      endsAt: 100_000,
      durationSec: 90,
      workoutExerciseId: 'we-1',
    })
  })

  it('counts down from the stored end, rounding up to whole seconds', () => {
    expect(remainingSeconds(timer, 10_000)).toBe(90)
    expect(remainingSeconds(timer, 10_001)).toBe(90)
    expect(remainingSeconds(timer, 99_000)).toBe(1)
    expect(remainingSeconds(timer, 99_999)).toBe(1)
    expect(remainingSeconds(timer, 100_000)).toBe(0)
  })

  it('is right after a long time in the background, because it uses the clock', () => {
    // The app was suspended for ten minutes: nothing ticked, the end is fixed.
    expect(remainingSeconds(timer, 10_000 + 600_000)).toBe(0)
    expect(isRestFinished(timer, 10_000 + 600_000)).toBe(true)
  })

  it('is finished exactly at the end, and not before', () => {
    expect(isRestFinished(timer, 99_999)).toBe(false)
    expect(isRestFinished(timer, 100_000)).toBe(true)
  })
})

describe('adjustRestTimer', () => {
  const timer = startRestTimer('we-1', 90, 0)

  it('adds and removes time at the end', () => {
    expect(adjustRestTimer(timer, 15, 20_000)).toMatchObject({
      endsAt: 105_000,
      durationSec: 105,
    })
    expect(adjustRestTimer(timer, -15, 20_000)).toMatchObject({
      endsAt: 75_000,
      durationSec: 75,
    })
  })

  it('cannot end before now: shortening a nearly done timer finishes it', () => {
    const result = adjustRestTimer(timer, -15, 85_000)

    expect(result.endsAt).toBe(85_000)
    expect(isRestFinished(result, 85_000)).toBe(true)
  })

  it('never lets the duration go below zero', () => {
    const short = startRestTimer('we-1', 10, 0)

    expect(adjustRestTimer(short, -15, 0).durationSec).toBe(0)
  })

  it('keeps the workout exercise and does not change the original', () => {
    const result = adjustRestTimer(timer, 15, 0)

    expect(result.workoutExerciseId).toBe('we-1')
    expect(timer.endsAt).toBe(90_000)
  })
})
