import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../test/db'
import { at, freezeTime, makeExercise, unfreezeTime } from '../../test/fixtures'
import { db } from '../db'
import { addSet, deleteSet } from './sets'
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  listWorkouts,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  startWorkout,
  updateWorkout,
} from './workouts'

beforeEach(resetDb)
afterEach(() => {
  vi.restoreAllMocks()
  unfreezeTime()
})

/** A workout with two exercises, and two sets on the first. */
async function sampleWorkout() {
  const bench = await makeExercise('Bench Press')
  const row = await makeExercise('Barbell Row')
  const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
  const first = await addExerciseToWorkout(workout.id, bench.id)
  const second = await addExerciseToWorkout(workout.id, row.id)
  const set1 = await addSet(first.id, { weightKg: 80, reps: 5 })
  const set2 = await addSet(first.id, { weightKg: 80, reps: 5 })
  return { workout, first, second, set1, set2 }
}

describe('startWorkout', () => {
  it('creates an active workout dated by the local day it started', async () => {
    freezeTime(5_000)
    const startedAt = at(2026, 7, 1, 0, 30) // 22:30 UTC the day before

    const workout = await startWorkout({ title: 'Push', now: startedAt })

    expect(workout).toMatchObject({
      status: 'active',
      date: '2026-07-01',
      startedAt,
      endedAt: null,
      title: 'Push',
      notes: '',
      templateId: null,
      deletedAt: null,
      createdAt: 5_000,
      updatedAt: 5_000,
    })
    expect(await db.workouts.get(workout.id)).toEqual(workout)
  })

  it('records the template it was started from', async () => {
    const workout = await startWorkout({ templateId: 'template-1' })
    expect(workout.templateId).toBe('template-1')
  })

  it('returns the existing active workout instead of creating a second', async () => {
    const first = await startWorkout({ title: 'First' })
    const second = await startWorkout({ title: 'Second' })

    expect(second).toEqual(first)
    expect(await db.workouts.count()).toBe(1)
  })

  it('creates only one workout when two starts race', async () => {
    const [a, b] = await Promise.all([startWorkout(), startWorkout()])

    expect(a.id).toBe(b.id)
    expect(await db.workouts.count()).toBe(1)
  })

  it('allows a new workout after the previous one is finished', async () => {
    const first = await startWorkout()
    await finishWorkout(first.id)

    const second = await startWorkout()

    expect(second.id).not.toBe(first.id)
    expect(await db.workouts.count()).toBe(2)
  })

  it('is not blocked by a deleted active workout', async () => {
    const first = await startWorkout()
    await deleteWorkout(first.id)

    const second = await startWorkout()

    expect(second.id).not.toBe(first.id)
    expect((await getActiveWorkout())?.id).toBe(second.id)
  })

  it('keeps a session that runs past midnight on the day it started', async () => {
    const workout = await startWorkout({ now: at(2026, 10, 24, 23, 50) })
    const finished = await finishWorkout(workout.id, at(2026, 10, 25, 0, 40))

    expect(finished.date).toBe('2026-10-24')
    expect(finished.status).toBe('completed')
  })
})

describe('finishWorkout', () => {
  it('completes the workout and sets updatedAt', async () => {
    freezeTime(1_000)
    const workout = await startWorkout({ now: 500 })
    freezeTime(2_000)

    const finished = await finishWorkout(workout.id, 1_800)

    expect(finished).toMatchObject({
      status: 'completed',
      endedAt: 1_800,
      updatedAt: 2_000,
      createdAt: 1_000,
    })
    expect(await getActiveWorkout()).toBeUndefined()
  })

  it('does nothing when the workout is already completed', async () => {
    const workout = await startWorkout({ now: 500 })
    const once = await finishWorkout(workout.id, 1_000)
    freezeTime(9_000)

    const twice = await finishWorkout(workout.id, 2_000)

    expect(twice).toEqual(once)
  })

  it('rejects an end time before the start and changes nothing', async () => {
    const workout = await startWorkout({ now: 5_000 })

    await expect(finishWorkout(workout.id, 4_000)).rejects.toThrow(
      /before it starts/,
    )

    expect(await db.workouts.get(workout.id)).toEqual(workout)
  })

  it('rejects an unknown workout', async () => {
    await expect(finishWorkout('nope')).rejects.toThrow('Workout not found')
  })
})

describe('reads exclude soft-deleted rows', () => {
  it('hides a deleted workout from get, list and active', async () => {
    const workout = await startWorkout()
    await deleteWorkout(workout.id)

    expect(await getWorkout(workout.id)).toBeUndefined()
    expect(await listWorkouts()).toEqual([])
    expect(await getActiveWorkout()).toBeUndefined()
    expect(await db.workouts.get(workout.id)).toBeDefined()
  })

  it('lists workouts newest first', async () => {
    const older = await startWorkout({ now: at(2026, 11, 1, 10) })
    await finishWorkout(older.id)
    const newer = await startWorkout({ now: at(2026, 11, 8, 10) })

    expect((await listWorkouts()).map((w) => w.id)).toEqual([
      newer.id,
      older.id,
    ])
  })
})

describe('deleteWorkout', () => {
  it('soft-deletes the workout, its exercises and its sets with one timestamp', async () => {
    const { workout, first, second, set1, set2 } = await sampleWorkout()
    freezeTime(9_000)

    await deleteWorkout(workout.id)

    for (const [table, id] of [
      [db.workouts, workout.id],
      [db.workoutExercises, first.id],
      [db.workoutExercises, second.id],
      [db.sets, set1.id],
      [db.sets, set2.id],
    ] as const) {
      expect(await table.get(id)).toMatchObject({
        deletedAt: 9_000,
        updatedAt: 9_000,
      })
    }
    expect(await listWorkoutExercises(workout.id)).toEqual([])
  })

  it('leaves other workouts untouched', async () => {
    const a = await sampleWorkout()
    await finishWorkout(a.workout.id)
    const b = await sampleWorkout()

    await deleteWorkout(a.workout.id)

    expect(await getWorkout(b.workout.id)).toBeDefined()
    expect(await listWorkoutExercises(b.workout.id)).toHaveLength(2)
    expect((await db.sets.get(b.set1.id))?.deletedAt).toBeNull()
  })

  it('keeps the original delete time of a set removed earlier', async () => {
    const { workout, set1, set2 } = await sampleWorkout()
    freezeTime(3_000)
    await deleteSet(set1.id)
    freezeTime(9_000)

    await deleteWorkout(workout.id)

    expect((await db.sets.get(set1.id))?.deletedAt).toBe(3_000)
    expect((await db.sets.get(set2.id))?.deletedAt).toBe(9_000)
  })

  it('is atomic: a failure while deleting sets leaves everything intact', async () => {
    const { workout, first, set1 } = await sampleWorkout()
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(deleteWorkout(workout.id)).rejects.toThrow('disk full')

    expect((await db.workouts.get(workout.id))?.deletedAt).toBeNull()
    expect((await db.workoutExercises.get(first.id))?.deletedAt).toBeNull()
    expect((await db.sets.get(set1.id))?.deletedAt).toBeNull()
  })

  it('cannot delete a workout twice', async () => {
    const workout = await startWorkout()
    await deleteWorkout(workout.id)

    await expect(deleteWorkout(workout.id)).rejects.toThrow('Workout not found')
  })
})

describe('updateWorkout', () => {
  it('edits title and notes and sets updatedAt, without touching sets', async () => {
    const { workout, set1 } = await sampleWorkout()
    freezeTime(9_000)

    const updated = await updateWorkout(workout.id, {
      title: 'Push day',
      notes: 'felt strong',
    })

    expect(updated).toMatchObject({
      title: 'Push day',
      notes: 'felt strong',
      updatedAt: 9_000,
      createdAt: workout.createdAt,
    })
    expect(await db.sets.get(set1.id)).toEqual(set1)
  })

  it('copies a changed date onto every set of the workout', async () => {
    const { workout, set1, set2 } = await sampleWorkout()
    freezeTime(9_000)

    await updateWorkout(workout.id, { date: '2026-11-07' })

    expect((await getWorkout(workout.id))?.date).toBe('2026-11-07')
    for (const id of [set1.id, set2.id]) {
      expect(await db.sets.get(id)).toMatchObject({
        date: '2026-11-07',
        updatedAt: 9_000,
      })
    }
  })

  it('also fixes the date of soft-deleted sets, so an undo is never stale', async () => {
    const { workout, set1 } = await sampleWorkout()
    await deleteSet(set1.id)

    await updateWorkout(workout.id, { date: '2026-11-07' })

    expect(await db.sets.get(set1.id)).toMatchObject({
      date: '2026-11-07',
      deletedAt: expect.any(Number),
    })
  })

  it('does not touch the sets of other workouts', async () => {
    const a = await sampleWorkout()
    await finishWorkout(a.workout.id)
    const b = await sampleWorkout()

    await updateWorkout(a.workout.id, { date: '2026-01-01' })

    expect((await db.sets.get(b.set1.id))?.date).toBe('2026-11-09')
  })

  it('is atomic: a failure while updating sets leaves the date unchanged', async () => {
    const { workout, set1 } = await sampleWorkout()
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(
      updateWorkout(workout.id, { date: '2026-11-07', title: 'Changed' }),
    ).rejects.toThrow('disk full')

    expect(await db.workouts.get(workout.id)).toEqual(workout)
    expect(await db.sets.get(set1.id)).toEqual(set1)
  })

  it('moves the date with startedAt when no date is given', async () => {
    const { workout, set1 } = await sampleWorkout()

    const updated = await updateWorkout(workout.id, {
      startedAt: at(2026, 11, 8, 23, 30),
    })

    expect(updated.date).toBe('2026-11-08')
    expect((await db.sets.get(set1.id))?.date).toBe('2026-11-08')
  })

  it('lets an explicit date win over startedAt', async () => {
    const { workout } = await sampleWorkout()

    const updated = await updateWorkout(workout.id, {
      startedAt: at(2026, 11, 8, 23, 30),
      date: '2026-11-01',
    })

    expect(updated.date).toBe('2026-11-01')
  })

  it('rejects an invalid date and an end before the start', async () => {
    const { workout } = await sampleWorkout()

    await expect(
      updateWorkout(workout.id, { date: '2026-02-30' }),
    ).rejects.toThrow(/Invalid date/)
    await expect(
      updateWorkout(workout.id, { endedAt: workout.startedAt - 1 }),
    ).rejects.toThrow(/before it starts/)

    expect(await db.workouts.get(workout.id)).toEqual(workout)
  })

  it('cannot edit a deleted workout', async () => {
    const workout = await startWorkout()
    await deleteWorkout(workout.id)

    await expect(updateWorkout(workout.id, { title: 'x' })).rejects.toThrow(
      'Workout not found',
    )
  })
})

describe('workout exercises', () => {
  it('numbers exercises contiguously from 0 as they are added', async () => {
    const { workout } = await sampleWorkout()
    const squat = await makeExercise('Squat')

    await addExerciseToWorkout(workout.id, squat.id)

    const positions = (await listWorkoutExercises(workout.id)).map(
      (e) => e.position,
    )
    expect(positions).toEqual([0, 1, 2])
  })

  it('rejects a missing or deleted workout or exercise', async () => {
    const { workout } = await sampleWorkout()
    const exercise = await makeExercise('Squat')

    await expect(addExerciseToWorkout('nope', exercise.id)).rejects.toThrow(
      'Workout not found',
    )
    await expect(addExerciseToWorkout(workout.id, 'nope')).rejects.toThrow(
      'Exercise not found',
    )
  })

  it('removes an exercise with its sets and closes the gap', async () => {
    const { workout, first, second, set1, set2 } = await sampleWorkout()
    const third = await addExerciseToWorkout(
      workout.id,
      (await makeExercise('Squat')).id,
    )
    const secondSet = await addSet(second.id, { weightKg: 60, reps: 8 })

    await removeWorkoutExercise(first.id)

    const remaining = await listWorkoutExercises(workout.id)
    expect(remaining.map((e) => [e.id, e.position])).toEqual([
      [second.id, 0],
      [third.id, 1],
    ])
    expect((await db.sets.get(set1.id))?.deletedAt).not.toBeNull()
    expect((await db.sets.get(set2.id))?.deletedAt).not.toBeNull()
    expect((await db.sets.get(secondSet.id))?.deletedAt).toBeNull()
  })

  it('keeps positions contiguous when the last exercise is removed', async () => {
    const { workout, second } = await sampleWorkout()

    await removeWorkoutExercise(second.id)

    const positions = (await listWorkoutExercises(workout.id)).map(
      (e) => e.position,
    )
    expect(positions).toEqual([0])
  })

  it('does not renumber the exercises of another workout', async () => {
    const a = await sampleWorkout()
    await finishWorkout(a.workout.id)
    const b = await sampleWorkout()

    await removeWorkoutExercise(a.first.id)

    expect(
      (await listWorkoutExercises(b.workout.id)).map((e) => e.position),
    ).toEqual([0, 1])
  })

  it('is atomic: a failure while removing sets keeps the exercise', async () => {
    const { first, set1 } = await sampleWorkout()
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(removeWorkoutExercise(first.id)).rejects.toThrow('disk full')

    expect((await db.workoutExercises.get(first.id))?.deletedAt).toBeNull()
    expect((await db.sets.get(set1.id))?.deletedAt).toBeNull()
  })

  it('reorders with contiguous positions and sets updatedAt on moved rows', async () => {
    const { workout, first, second } = await sampleWorkout()
    const third = await addExerciseToWorkout(
      workout.id,
      (await makeExercise('Squat')).id,
    )
    freezeTime(9_000)

    await reorderWorkoutExercises(workout.id, [third.id, first.id, second.id])

    const rows = await listWorkoutExercises(workout.id)
    expect(rows.map((e) => [e.id, e.position])).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ])
    expect(rows.every((e) => e.updatedAt === 9_000)).toBe(true)
  })

  it('rejects an order that is not a permutation of the exercises', async () => {
    const { workout, first, second } = await sampleWorkout()

    await expect(
      reorderWorkoutExercises(workout.id, [first.id]),
    ).rejects.toThrow(/exactly once/)
    await expect(
      reorderWorkoutExercises(workout.id, [first.id, first.id]),
    ).rejects.toThrow(/exactly once/)
    await expect(
      reorderWorkoutExercises(workout.id, [first.id, 'stranger']),
    ).rejects.toThrow(/exactly once/)

    expect((await listWorkoutExercises(workout.id)).map((e) => e.id)).toEqual([
      first.id,
      second.id,
    ])
  })
})
