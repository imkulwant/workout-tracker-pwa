import { describe, expect, it } from 'vitest'
import { findMuscleProblem, toNameKey } from './exercises'
import type { MuscleId } from './types'

describe('toNameKey', () => {
  it('lower-cases and trims', () => {
    expect(toNameKey('  Barbell Bench Press ')).toBe('barbell bench press')
    expect(toNameKey('PUSH-UP')).toBe('push-up')
  })

  it('makes names that differ only by case or edge spaces collide', () => {
    expect(toNameKey('Pull-Up')).toBe(toNameKey(' pull-up'))
  })
})

describe('findMuscleProblem', () => {
  it('accepts a valid mapping', () => {
    expect(findMuscleProblem(['chest'], ['front_delts', 'triceps'])).toBeNull()
    expect(findMuscleProblem(['biceps', 'forearms'], [])).toBeNull()
  })

  it('requires at least one primary muscle', () => {
    expect(findMuscleProblem([], ['chest'])).toMatch(/at least one primary/)
    expect(findMuscleProblem([], [])).toMatch(/at least one primary/)
  })

  it('rejects a muscle that is both primary and secondary', () => {
    expect(findMuscleProblem(['chest', 'triceps'], ['triceps'])).toMatch(
      /triceps cannot be both primary and secondary/,
    )
  })

  it('rejects repeats within a list', () => {
    expect(findMuscleProblem(['chest', 'chest'], [])).toMatch(/primary muscle/)
    expect(findMuscleProblem(['chest'], ['triceps', 'triceps'])).toMatch(
      /secondary muscle/,
    )
  })

  it('rejects unknown muscle ids', () => {
    expect(findMuscleProblem(['pecs' as MuscleId], [])).toMatch(
      /Unknown muscle: pecs/,
    )
    expect(findMuscleProblem(['chest'], ['abs', 'core' as MuscleId])).toMatch(
      /Unknown muscle: core/,
    )
  })
})
