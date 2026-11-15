import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../domain/types'
import {
  blankValues,
  toExerciseInput,
  valuesFromExercise,
  type ExerciseFormValues,
} from './formValues'

const valid = (
  overrides: Partial<ExerciseFormValues> = {},
): ExerciseFormValues => ({
  ...blankValues('Landmine Press'),
  primary: ['front_delts'],
  ...overrides,
})

const errorsOf = (values: ExerciseFormValues) => {
  const result = toExerciseInput(values)
  if (result.ok) throw new Error('expected errors')
  return result.errors
}

describe('toExerciseInput', () => {
  it('turns a minimal valid form into an exercise input with defaults', () => {
    const result = toExerciseInput(valid())

    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Landmine Press',
        equipment: 'barbell',
        loadType: 'weight_reps',
        primaryMuscles: ['front_delts'],
        secondaryMuscles: [],
        notes: '',
        defaultRestSec: null,
        incrementKg: 2.5,
      },
    })
  })

  it('trims the name and the notes', () => {
    const result = toExerciseInput(
      valid({ name: '  Landmine Press  ', notes: ' go slow ' }),
    )

    expect(result).toMatchObject({
      ok: true,
      input: { name: 'Landmine Press', notes: 'go slow' },
    })
  })

  it('requires a name', () => {
    expect(errorsOf(valid({ name: '   ' }))).toEqual({ name: 'Enter a name.' })
  })

  it('requires a primary muscle', () => {
    expect(errorsOf(valid({ primary: [] })).muscles).toMatch(
      /at least one primary/,
    )
  })

  it('says which muscle is both primary and secondary, by its label', () => {
    expect(
      errorsOf(
        valid({ primary: ['front_delts', 'triceps'], secondary: ['triceps'] }),
      ).muscles,
    ).toBe('Triceps cannot be both primary and secondary.')
    expect(
      errorsOf(valid({ primary: ['front_delts'], secondary: ['front_delts'] }))
        .muscles,
    ).toBe('Front delts cannot be both primary and secondary.')
  })

  it('treats a blank rest as no default, and reads whole seconds', () => {
    expect(toExerciseInput(valid({ restSec: '' }))).toMatchObject({
      input: { defaultRestSec: null },
    })
    expect(toExerciseInput(valid({ restSec: '  ' }))).toMatchObject({
      input: { defaultRestSec: null },
    })
    expect(toExerciseInput(valid({ restSec: '90' }))).toMatchObject({
      input: { defaultRestSec: 90 },
    })
    expect(toExerciseInput(valid({ restSec: '0' }))).toMatchObject({
      input: { defaultRestSec: 0 },
    })
  })

  it.each(['90,5', '1.5', 'abc', '-5'])(
    'rejects %j as a rest time',
    (restSec) => {
      expect(errorsOf(valid({ restSec })).restSec).toMatch(/whole seconds/)
    },
  )

  it('reads the increment with a comma or a point', () => {
    expect(toExerciseInput(valid({ incrementKg: '2,5' }))).toMatchObject({
      input: { incrementKg: 2.5 },
    })
    expect(toExerciseInput(valid({ incrementKg: '1.25' }))).toMatchObject({
      input: { incrementKg: 1.25 },
    })
  })

  it.each(['', '0', 'abc', '-1'])(
    'rejects %j as an increment',
    (incrementKg) => {
      expect(errorsOf(valid({ incrementKg })).incrementKg).toMatch(/above 0/)
    },
  )

  it('reports every problem at once, each against its own field', () => {
    const errors = errorsOf(
      valid({ name: '', primary: [], restSec: 'x', incrementKg: '0' }),
    )

    expect(Object.keys(errors).sort()).toEqual([
      'incrementKg',
      'muscles',
      'name',
      'restSec',
    ])
  })
})

describe('valuesFromExercise', () => {
  const exercise: Exercise = {
    id: 'e1',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    name: 'Hammer Curl',
    nameKey: 'hammer curl',
    equipment: 'dumbbell',
    loadType: 'weight_reps',
    primaryMuscles: ['biceps', 'forearms'],
    secondaryMuscles: [],
    isCustom: false,
    notes: 'neutral grip',
    defaultRestSec: 75,
    incrementKg: 2,
    archivedAt: null,
  }

  it('fills the form from an exercise, with numbers as text', () => {
    expect(valuesFromExercise(exercise)).toEqual({
      name: 'Hammer Curl',
      equipment: 'dumbbell',
      loadType: 'weight_reps',
      primary: ['biceps', 'forearms'],
      secondary: [],
      restSec: '75',
      incrementKg: '2',
      notes: 'neutral grip',
    })
  })

  it('shows no default rest as an empty field', () => {
    expect(
      valuesFromExercise({ ...exercise, defaultRestSec: null }).restSec,
    ).toBe('')
  })

  it('round-trips back to the same input', () => {
    const result = toExerciseInput(valuesFromExercise(exercise))

    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Hammer Curl',
        equipment: 'dumbbell',
        loadType: 'weight_reps',
        primaryMuscles: ['biceps', 'forearms'],
        secondaryMuscles: [],
        notes: 'neutral grip',
        defaultRestSec: 75,
        incrementKg: 2,
      },
    })
  })

  it('copies the muscle lists, so editing the form cannot change the exercise', () => {
    const values = valuesFromExercise(exercise)
    values.primary.push('chest')
    expect(exercise.primaryMuscles).toEqual(['biceps', 'forearms'])
  })
})
