import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freezeTime, makeExercise, unfreezeTime } from '../../test/fixtures'
import { resetDb } from '../../test/db'
import { db } from '../db'
import { createTemplate } from './templates'
import { InvariantError } from './common'
import {
  archiveExercise,
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  unarchiveExercise,
  updateExercise,
  type ExerciseInput,
} from './exercises'
import { addExerciseToWorkout, deleteWorkout, startWorkout } from './workouts'

beforeEach(resetDb)
afterEach(unfreezeTime)

describe('createExercise', () => {
  it('creates a custom exercise with the plan defaults', async () => {
    freezeTime(1_000)
    const exercise = await createExercise({
      name: '  Landmine Press ',
      equipment: 'barbell',
      loadType: 'weight_reps',
      primaryMuscles: ['front_delts'],
    })

    expect(exercise).toMatchObject({
      name: 'Landmine Press',
      nameKey: 'landmine press',
      isCustom: true,
      notes: '',
      defaultRestSec: null,
      incrementKg: 2.5,
      archivedAt: null,
      deletedAt: null,
      secondaryMuscles: [],
      createdAt: 1_000,
      updatedAt: 1_000,
    })
    expect(await db.exercises.get(exercise.id)).toEqual(exercise)
  })

  it('rejects an empty name', async () => {
    await expect(
      createExercise({
        name: '   ',
        equipment: 'other',
        loadType: 'weight_reps',
        primaryMuscles: ['chest'],
      }),
    ).rejects.toThrow(InvariantError)
    expect(await db.exercises.count()).toBe(0)
  })

  it('requires at least one primary muscle', async () => {
    await expect(
      createExercise({
        name: 'Nothing',
        equipment: 'other',
        loadType: 'weight_reps',
        primaryMuscles: [],
        secondaryMuscles: ['chest'],
      }),
    ).rejects.toThrow(/at least one primary/)
    expect(await db.exercises.count()).toBe(0)
  })

  it('never lets a muscle be both primary and secondary', async () => {
    await expect(
      createExercise({
        name: 'Overlap',
        equipment: 'other',
        loadType: 'weight_reps',
        primaryMuscles: ['chest', 'triceps'],
        secondaryMuscles: ['triceps'],
      }),
    ).rejects.toThrow(/triceps cannot be both primary and secondary/)
    expect(await db.exercises.count()).toBe(0)
  })

  it('rejects a non-positive increment and a bad rest time', async () => {
    const base: ExerciseInput = {
      name: 'Odd',
      equipment: 'other',
      loadType: 'weight_reps',
      primaryMuscles: ['chest'],
    }
    await expect(createExercise({ ...base, incrementKg: 0 })).rejects.toThrow(
      InvariantError,
    )
    await expect(
      createExercise({ ...base, defaultRestSec: -5 }),
    ).rejects.toThrow(InvariantError)
    await expect(
      createExercise({ ...base, defaultRestSec: 90.5 }),
    ).rejects.toThrow(InvariantError)
    expect(await db.exercises.count()).toBe(0)
  })
})

describe('updateExercise', () => {
  it('changes fields, recomputes the name key and sets updatedAt', async () => {
    freezeTime(1_000)
    const exercise = await makeExercise('Bench Press')
    freezeTime(2_000)

    const updated = await updateExercise(exercise.id, {
      name: ' Flat Bench ',
      defaultRestSec: 90,
      notes: 'pause reps',
    })

    expect(updated).toMatchObject({
      name: 'Flat Bench',
      nameKey: 'flat bench',
      defaultRestSec: 90,
      notes: 'pause reps',
      createdAt: 1_000,
      updatedAt: 2_000,
    })
    expect(await getExercise(exercise.id)).toEqual(updated)
  })

  it('can clear the rest time back to null', async () => {
    const exercise = await createExercise({
      name: 'Row',
      equipment: 'cable',
      loadType: 'weight_reps',
      primaryMuscles: ['lats'],
      defaultRestSec: 60,
    })
    const updated = await updateExercise(exercise.id, { defaultRestSec: null })
    expect(updated.defaultRestSec).toBeNull()
  })

  it('rejects an overlap and leaves the stored row untouched', async () => {
    const exercise = await makeExercise()
    await expect(
      updateExercise(exercise.id, { secondaryMuscles: ['chest'] }),
    ).rejects.toThrow(/chest cannot be both primary and secondary/)
    expect(await db.exercises.get(exercise.id)).toEqual(exercise)
  })

  it('rejects an update that would leave no primary muscle', async () => {
    const exercise = await makeExercise()
    await expect(
      updateExercise(exercise.id, { primaryMuscles: [] }),
    ).rejects.toThrow(/at least one primary/)
  })

  it('cannot update a missing or deleted exercise', async () => {
    await expect(updateExercise('nope', { notes: 'x' })).rejects.toThrow(
      'Exercise not found',
    )
    const exercise = await makeExercise()
    await deleteExercise(exercise.id)
    await expect(updateExercise(exercise.id, { notes: 'x' })).rejects.toThrow(
      'Exercise not found',
    )
  })
})

describe('archive and delete', () => {
  it('hides an archived exercise from the picker but keeps it readable', async () => {
    freezeTime(1_000)
    const exercise = await makeExercise()
    freezeTime(2_000)

    const archived = await archiveExercise(exercise.id)

    expect(archived.archivedAt).toBe(2_000)
    expect(archived.updatedAt).toBe(2_000)
    expect(await listExercises()).toEqual([])
    expect(await listExercises({ includeArchived: true })).toHaveLength(1)
    expect(await getExercise(exercise.id)).toMatchObject({ archivedAt: 2_000 })
  })

  it('keeps the original archive time when archived twice, and can unarchive', async () => {
    const exercise = await makeExercise()
    freezeTime(2_000)
    await archiveExercise(exercise.id)
    freezeTime(3_000)
    expect((await archiveExercise(exercise.id)).archivedAt).toBe(2_000)

    const restored = await unarchiveExercise(exercise.id)
    expect(restored.archivedAt).toBeNull()
    expect(await listExercises()).toHaveLength(1)
  })

  it('soft-deletes an unused exercise, and reads then exclude it', async () => {
    freezeTime(1_000)
    const exercise = await makeExercise()
    freezeTime(2_000)

    await deleteExercise(exercise.id)

    expect(await db.exercises.get(exercise.id)).toMatchObject({
      deletedAt: 2_000,
      updatedAt: 2_000,
    })
    expect(await getExercise(exercise.id)).toBeUndefined()
    expect(await listExercises({ includeArchived: true })).toEqual([])
  })

  it('refuses to delete an exercise used by a workout, and it stays intact', async () => {
    const exercise = await makeExercise()
    const workout = await startWorkout()
    await addExerciseToWorkout(workout.id, exercise.id)

    await expect(deleteExercise(exercise.id)).rejects.toThrow(/in use/)

    expect(await getExercise(exercise.id)).toEqual(exercise)
  })

  it('lets a used exercise be archived and still appear in history', async () => {
    const exercise = await makeExercise()
    const workout = await startWorkout()
    await addExerciseToWorkout(workout.id, exercise.id)

    await archiveExercise(exercise.id)

    expect(await getExercise(exercise.id)).toMatchObject({
      name: exercise.name,
    })
    expect(await listExercises()).toEqual([])
  })

  it('refuses to delete an exercise used by a template', async () => {
    const exercise = await makeExercise()
    await createTemplate({
      name: 'Push',
      items: [
        {
          exerciseId: exercise.id,
          targetSets: 3,
          targetReps: 8,
          restSec: null,
        },
      ],
    })

    await expect(deleteExercise(exercise.id)).rejects.toThrow(/in use/)
  })

  it('allows deleting once the only workout that used it is deleted', async () => {
    const exercise = await makeExercise()
    const workout = await startWorkout()
    await addExerciseToWorkout(workout.id, exercise.id)
    await deleteWorkout(workout.id)

    await deleteExercise(exercise.id)

    expect(await getExercise(exercise.id)).toBeUndefined()
  })
})

describe('listExercises', () => {
  it('lists exercises alphabetically by name key', async () => {
    await makeExercise('squat')
    await makeExercise('Bench Press')
    await makeExercise('Deadlift')

    const names = (await listExercises()).map((e) => e.name)

    expect(names).toEqual(['Bench Press', 'Deadlift', 'squat'])
  })
})
