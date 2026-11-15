import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../test/db'
import { at, makeExercise } from '../../test/fixtures'
import { db } from '../db'
import { archiveExercise } from './exercises'
import { addSet, listSets, listWorkoutSets } from './sets'
import {
  createTemplate,
  createTemplateFromWorkout,
  deleteTemplate,
  listTemplateUsage,
  startWorkoutFromTemplate,
  updateTemplate,
} from './templates'
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  startWorkout,
} from './workouts'

beforeEach(resetDb)

const targets = async (workoutId: string) =>
  Promise.all(
    (await listWorkoutExercises(workoutId)).map(async (row) => ({
      exerciseId: row.exerciseId,
      sets: (await listSets(row.id)).map((s) => [
        s.weightKg,
        s.reps,
        s.completedAt,
      ]),
    })),
  )

describe('startWorkoutFromTemplate', () => {
  it('starts a workout named for the template, with its exercises in order and target sets', async () => {
    const bench = await makeExercise('Bench Press')
    const row = await makeExercise('Barbell Row')
    const template = await createTemplate({
      name: 'Upper A',
      items: [
        { exerciseId: row.id, targetSets: 2, targetReps: 10, restSec: 90 },
        { exerciseId: bench.id, targetSets: 3, targetReps: 5, restSec: null },
      ],
    })

    const workout = await startWorkoutFromTemplate(
      template.id,
      at(2026, 11, 9, 18),
    )

    expect(workout).toMatchObject({
      title: 'Upper A',
      templateId: template.id,
      status: 'active',
      startedAt: at(2026, 11, 9, 18),
    })
    expect(await targets(workout.id)).toEqual([
      {
        exerciseId: row.id,
        sets: [
          [null, 10, null],
          [null, 10, null],
        ],
      },
      {
        exerciseId: bench.id,
        sets: [
          [null, 5, null],
          [null, 5, null],
          [null, 5, null],
        ],
      },
    ])
  })

  it('prefills from the last session of each exercise, then the row above, then the target reps', async () => {
    const bench = await makeExercise('Bench Press')
    const earlier = await startWorkout({ now: at(2026, 11, 2, 18) })
    const earlierRow = await addExerciseToWorkout(earlier.id, bench.id)
    await addSet(earlierRow.id, {
      weightKg: 80,
      reps: 6,
      completedAt: at(2026, 11, 2, 18, 10),
    })
    await addSet(earlierRow.id, {
      weightKg: 82.5,
      reps: 5,
      completedAt: at(2026, 11, 2, 18, 20),
    })
    await finishWorkout(earlier.id, at(2026, 11, 2, 19))
    const template = await createTemplate({
      name: 'Push',
      items: [
        { exerciseId: bench.id, targetSets: 4, targetReps: 8, restSec: null },
      ],
    })

    const workout = await startWorkoutFromTemplate(
      template.id,
      at(2026, 11, 9, 18),
    )

    expect((await targets(workout.id))[0]!.sets).toEqual([
      [80, 6, null], // the same position last time
      [82.5, 5, null],
      [82.5, 5, null], // no third set last time: the row above
      [82.5, 5, null],
    ])
  })

  it('skips an exercise that was deleted, and keeps an archived one', async () => {
    const bench = await makeExercise('Bench Press')
    const gone = await makeExercise('Old Lift')
    const archived = await makeExercise('Archived Lift')
    const template = await createTemplate({
      name: 'Mixed',
      items: [bench, gone, archived].map((e) => ({
        exerciseId: e.id,
        targetSets: 1,
        targetReps: null,
        restSec: null,
      })),
    })
    await db.exercises.put({
      ...(await db.exercises.get(gone.id))!,
      deletedAt: 5,
    })
    await archiveExercise(archived.id)

    const workout = await startWorkoutFromTemplate(template.id)

    expect((await targets(workout.id)).map((t) => t.exerciseId)).toEqual([
      bench.id,
      archived.id,
    ])
  })

  it('returns the workout already in progress and adds nothing', async () => {
    const bench = await makeExercise('Bench Press')
    const template = await createTemplate({
      name: 'Push',
      items: [
        { exerciseId: bench.id, targetSets: 3, targetReps: 5, restSec: null },
      ],
    })
    const active = await startWorkout()

    const result = await startWorkoutFromTemplate(template.id)

    expect(result.id).toBe(active.id)
    expect(await db.sets.count()).toBe(0)
  })

  it('refuses a template that does not exist or was deleted', async () => {
    await expect(startWorkoutFromTemplate('nope')).rejects.toThrow(
      'Template not found',
    )
    const template = await createTemplate({ name: 'Gone' })
    await deleteTemplate(template.id)
    await expect(startWorkoutFromTemplate(template.id)).rejects.toThrow(
      'Template not found',
    )
  })

  it('starts an empty workout from an empty template', async () => {
    const template = await createTemplate({ name: 'Blank' })
    const workout = await startWorkoutFromTemplate(template.id)
    expect(await targets(workout.id)).toEqual([])
    expect((await getActiveWorkout())?.id).toBe(workout.id)
  })

  it('is atomic: a failure part-way leaves no workout behind', async () => {
    const bench = await makeExercise('Bench Press')
    const row = await makeExercise('Row')
    const template = await createTemplate({
      name: 'Two',
      items: [bench, row].map((e) => ({
        exerciseId: e.id,
        targetSets: 2,
        targetReps: 5,
        restSec: null,
      })),
    })
    let calls = 0
    const real = db.sets.add.bind(db.sets)
    vi.spyOn(db.sets, 'add').mockImplementation((...args) => {
      if (++calls === 3) return Promise.reject(new Error('disk full')) as never
      return real(...args)
    })

    await expect(startWorkoutFromTemplate(template.id)).rejects.toThrow(
      'disk full',
    )

    vi.restoreAllMocks()
    expect(await db.workouts.count()).toBe(0)
    expect(await db.workoutExercises.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
  })

  it('gives the workout its own copy, so editing or deleting the template changes nothing', async () => {
    const bench = await makeExercise('Bench Press')
    const row = await makeExercise('Row')
    const template = await createTemplate({
      name: 'Upper',
      items: [
        { exerciseId: bench.id, targetSets: 3, targetReps: 5, restSec: null },
        { exerciseId: row.id, targetSets: 2, targetReps: 8, restSec: null },
      ],
    })
    const workout = await startWorkoutFromTemplate(template.id)
    const before = await targets(workout.id)
    const setsBefore = await listWorkoutSets(workout.id)

    await updateTemplate(template.id, {
      name: 'Renamed',
      items: [
        { exerciseId: row.id, targetSets: 9, targetReps: 1, restSec: 30 },
      ],
    })
    await deleteTemplate(template.id)

    expect(await targets(workout.id)).toEqual(before)
    expect(await listWorkoutSets(workout.id)).toEqual(setsBefore)
    expect((await getWorkout(workout.id))?.title).toBe('Upper')
  })
})

describe('listTemplateUsage', () => {
  it('gives the latest start of each template, ignoring deleted workouts and other workouts', async () => {
    const a = await createTemplate({ name: 'A' })
    const b = await createTemplate({ name: 'B' })
    await createTemplate({ name: 'Never' })

    const first = await startWorkoutFromTemplate(a.id, at(2026, 11, 2, 18))
    await finishWorkout(first.id, at(2026, 11, 2, 19))
    const second = await startWorkoutFromTemplate(a.id, at(2026, 11, 9, 18))
    await finishWorkout(second.id, at(2026, 11, 9, 19))
    const gone = await startWorkoutFromTemplate(b.id, at(2026, 11, 10, 18))
    await finishWorkout(gone.id, at(2026, 11, 10, 19))
    await deleteWorkout(gone.id)
    await startWorkout({ now: at(2026, 11, 12, 18) }) // not from a template

    expect(Object.fromEntries(await listTemplateUsage())).toEqual({
      [a.id]: at(2026, 11, 9, 18),
    })
  })

  it('counts a workout in progress', async () => {
    const a = await createTemplate({ name: 'A' })
    await startWorkoutFromTemplate(a.id, at(2026, 11, 9, 18))
    expect((await listTemplateUsage()).get(a.id)).toBe(at(2026, 11, 9, 18))
  })
})

describe('createTemplateFromWorkout', () => {
  it('saves the completed sets of each exercise, in order', async () => {
    const bench = await makeExercise('Bench Press')
    const row = await makeExercise('Row')
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
    const benchRow = await addExerciseToWorkout(workout.id, bench.id)
    const rowRow = await addExerciseToWorkout(workout.id, row.id)
    const done = at(2026, 11, 9, 18, 30)
    await addSet(benchRow.id, { weightKg: 80, reps: 5, completedAt: done })
    await addSet(benchRow.id, { weightKg: 80, reps: 5, completedAt: done })
    await addSet(benchRow.id, { weightKg: 80, reps: 5 })
    await addSet(rowRow.id, { weightKg: 60, reps: 10, completedAt: done })
    await finishWorkout(workout.id, at(2026, 11, 9, 19))

    const template = await createTemplateFromWorkout(workout.id, 'My Upper')

    expect(template.name).toBe('My Upper')
    expect(template.items).toEqual([
      { exerciseId: bench.id, targetSets: 2, targetReps: 5, restSec: null },
      { exerciseId: row.id, targetSets: 1, targetReps: 10, restSec: null },
    ])
  })

  it('refuses a workout with nothing completed, and a blank name', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout()
    const benchRow = await addExerciseToWorkout(workout.id, bench.id)
    await addSet(benchRow.id, { weightKg: 80, reps: 5 })
    await expect(createTemplateFromWorkout(workout.id, 'X')).rejects.toThrow(
      'No set was completed in this workout',
    )
    await addSet(benchRow.id, { weightKg: 80, reps: 5, completedAt: 1 })
    await expect(createTemplateFromWorkout(workout.id, '  ')).rejects.toThrow(
      'Template name is required',
    )
    expect(await db.templates.count()).toBe(0)
  })
})
