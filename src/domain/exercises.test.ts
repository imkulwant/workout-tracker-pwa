import { describe, expect, it } from 'vitest'
import { filterExercises, findMuscleProblem, toNameKey } from './exercises'
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

describe('filterExercises', () => {
  const ex = (name: string, ...primaryMuscles: MuscleId[]) => ({
    name,
    nameKey: toNameKey(name),
    primaryMuscles,
  })
  const library = [
    ex('Barbell Bench Press', 'chest'),
    ex('Incline Dumbbell Press', 'chest'),
    ex('Overhead Press', 'front_delts'),
    ex('Back Squat', 'quads', 'glutes'),
    ex('Barbell Row', 'upper_back', 'lats'),
    ex('Hammer Curl', 'biceps', 'forearms'),
  ]
  const names = (list: { name: string }[]) => list.map((e) => e.name)

  it('returns everything for an empty or blank query', () => {
    expect(filterExercises(library, {})).toHaveLength(6)
    expect(filterExercises(library, { query: '   ' })).toHaveLength(6)
  })

  it('matches part of a name, ignoring case', () => {
    expect(names(filterExercises(library, { query: 'PRESS' }))).toEqual([
      'Barbell Bench Press',
      'Incline Dumbbell Press',
      'Overhead Press',
    ])
  })

  it('needs every word, in any order', () => {
    expect(names(filterExercises(library, { query: 'press bench' }))).toEqual([
      'Barbell Bench Press',
    ])
    expect(filterExercises(library, { query: 'bench squat' })).toEqual([])
  })

  it('filters by body part using primary muscles only', () => {
    expect(names(filterExercises(library, { bodyPart: 'chest' }))).toEqual([
      'Barbell Bench Press',
      'Incline Dumbbell Press',
    ])
    expect(names(filterExercises(library, { bodyPart: 'legs' }))).toEqual([
      'Back Squat',
    ])
    expect(names(filterExercises(library, { bodyPart: 'back' }))).toEqual([
      'Barbell Row',
    ])
    expect(filterExercises(library, { bodyPart: null })).toHaveLength(6)
  })

  it('combines the query and the body part, and keeps the input order', () => {
    expect(
      names(
        filterExercises(library, { query: 'press', bodyPart: 'shoulders' }),
      ),
    ).toEqual(['Overhead Press'])
    expect(
      names(filterExercises([...library].reverse(), { query: 'press' })),
    ).toEqual([
      'Overhead Press',
      'Incline Dumbbell Press',
      'Barbell Bench Press',
    ])
  })

  it('searches thousands of exercises well inside the 100 ms budget', () => {
    const many = Array.from({ length: 5000 }, (_, i) =>
      ex(`Exercise ${i} Variation`, 'chest'),
    )

    const start = performance.now()
    const result = filterExercises(many, {
      query: 'exercise 42',
      bodyPart: 'chest',
    })
    const elapsed = performance.now() - start

    expect(result.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
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
      /Triceps cannot be both primary and secondary/,
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
