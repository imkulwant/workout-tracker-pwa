import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../test/db'
import { at, freezeTime, makeExercise, unfreezeTime } from '../../test/fixtures'
import type { Id, WorkoutExercise } from '../../domain/types'
import { db } from '../db'
import {
  addSet,
  deleteSet,
  discardIncompleteSets,
  listSets,
  listWorkoutSets,
  restoreSet,
} from './sets'
import {
  addExerciseToWorkout,
  deleteWorkout,
  getWorkoutExercise,
  listWorkoutExercises,
  removeWorkoutExercise,
  replaceWorkoutExercise,
  startWorkout,
  updateWorkoutExerciseNotes,
} from './workouts'

beforeEach(resetDb)
afterEach(() => {
  vi.restoreAllMocks()
  unfreezeTime()
})

/** A workout of two exercises. */
async function twoExercises() {
  const bench = await makeExercise('Bench Press')
  const squat = await makeExercise('Squat')
  const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
  const first = await addExerciseToWorkout(workout.id, bench.id)
  const second = await addExerciseToWorkout(workout.id, squat.id)
  return { bench, squat, workout, first, second }
}

/** Adds sets numbered 1..n by their reps, all unticked. */
async function addNumbered(workoutExerciseId: Id, n: number) {
  const sets = []
  for (let i = 1; i <= n; i++) {
    sets.push(await addSet(workoutExerciseId, { reps: i, weightKg: 50 }))
  }
  return sets
}

const repsOf = async (workoutExerciseId: Id) =>
  (await listSets(workoutExerciseId)).map((s) => s.reps)
const positionsOf = async (workoutExerciseId: Id) =>
  (await listSets(workoutExerciseId)).map((s) => s.position)

describe('restoreSet', () => {
  it('puts a deleted set back where it was, with positions contiguous', async () => {
    const { first } = await twoExercises()
    const sets = await addNumbered(first.id, 3)
    await deleteSet(sets[1]!.id)
    expect(await repsOf(first.id)).toEqual([1, 3])

    freezeTime(9_000)
    const restored = await restoreSet(sets[1]!.id)

    expect(restored).toMatchObject({
      deletedAt: null,
      position: 1,
      updatedAt: 9_000,
    })
    expect(await repsOf(first.id)).toEqual([1, 2, 3])
    expect(await positionsOf(first.id)).toEqual([0, 1, 2])
  })

  it('restores a first and a last set', async () => {
    const { first } = await twoExercises()
    const sets = await addNumbered(first.id, 3)

    await deleteSet(sets[0]!.id)
    await restoreSet(sets[0]!.id)
    expect(await repsOf(first.id)).toEqual([1, 2, 3])

    await deleteSet(sets[2]!.id)
    await restoreSet(sets[2]!.id)
    expect(await repsOf(first.id)).toEqual([1, 2, 3])
    expect(await positionsOf(first.id)).toEqual([0, 1, 2])
  })

  it('restores into the right place after another set was added meanwhile', async () => {
    const { first } = await twoExercises()
    const sets = await addNumbered(first.id, 3)
    await deleteSet(sets[1]!.id)
    await addSet(first.id, { reps: 4, weightKg: 50 })

    await restoreSet(sets[1]!.id)

    expect(await repsOf(first.id)).toEqual([1, 2, 3, 4])
    expect(await positionsOf(first.id)).toEqual([0, 1, 2, 3])
  })

  it('undoes two deletions in reverse order', async () => {
    const { first } = await twoExercises()
    const sets = await addNumbered(first.id, 4)
    await deleteSet(sets[1]!.id)
    await deleteSet(sets[3]!.id)
    expect(await repsOf(first.id)).toEqual([1, 3])

    await restoreSet(sets[3]!.id)
    await restoreSet(sets[1]!.id)

    expect(await repsOf(first.id)).toEqual([1, 2, 3, 4])
    expect(await positionsOf(first.id)).toEqual([0, 1, 2, 3])
  })

  it('does not touch the sets of other exercises', async () => {
    const { first, second } = await twoExercises()
    const sets = await addNumbered(first.id, 2)
    await addNumbered(second.id, 2)
    await deleteSet(sets[0]!.id)

    await restoreSet(sets[0]!.id)

    expect(await repsOf(second.id)).toEqual([1, 2])
  })

  it('rejects a set that was not deleted', async () => {
    const { first } = await twoExercises()
    const [set] = await addNumbered(first.id, 1)

    await expect(restoreSet(set!.id)).rejects.toThrow(
      'That set was not deleted',
    )
    await expect(restoreSet('nope')).rejects.toThrow('That set was not deleted')
  })

  it('rejects a set whose exercise was removed from the workout', async () => {
    const { first } = await twoExercises()
    const [set] = await addNumbered(first.id, 1)
    await deleteSet(set!.id)
    await removeWorkoutExercise(first.id)

    await expect(restoreSet(set!.id)).rejects.toThrow('Exercise not found')
  })

  it('is atomic: a failure while renumbering leaves the set deleted', async () => {
    const { first } = await twoExercises()
    const sets = await addNumbered(first.id, 3)
    await deleteSet(sets[1]!.id)
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(restoreSet(sets[1]!.id)).rejects.toThrow('disk full')

    expect((await db.sets.get(sets[1]!.id))?.deletedAt).not.toBeNull()
    expect(await repsOf(first.id)).toEqual([1, 3])
  })
})

describe('discardIncompleteSets', () => {
  it('discards unticked sets, keeps ticked ones in order, and returns the count', async () => {
    const { first } = await twoExercises()
    const sets = await addNumbered(first.id, 4)
    await db.sets.update(sets[0]!.id, { completedAt: 1 })
    await db.sets.update(sets[2]!.id, { completedAt: 1 })

    const discarded = await discardIncompleteSets(first.workoutId)

    expect(discarded).toBe(2)
    expect(await repsOf(first.id)).toEqual([1, 3])
    expect(await positionsOf(first.id)).toEqual([0, 1])
  })

  it('removes exercises left with no sets and renumbers the rest', async () => {
    const { workout, first, second } = await twoExercises()
    const third = await addExerciseToWorkout(
      workout.id,
      (await makeExercise('Row')).id,
    )
    await addNumbered(first.id, 2) // never ticked
    const done = await addNumbered(second.id, 2)
    await db.sets.update(done[0]!.id, { completedAt: 1 })
    // `third` has no sets at all.

    await discardIncompleteSets(workout.id)

    const left = await listWorkoutExercises(workout.id)
    expect(left.map((e: WorkoutExercise) => [e.id, e.position])).toEqual([
      [second.id, 0],
    ])
    expect(await getWorkoutExercise(first.id)).toBeUndefined()
    expect(await getWorkoutExercise(third.id)).toBeUndefined()
  })

  it('changes nothing when every set was ticked', async () => {
    const { workout, first } = await twoExercises()
    const sets = await addNumbered(first.id, 2)
    for (const set of sets) await db.sets.update(set.id, { completedAt: 1 })
    const before = await listWorkoutSets(workout.id)

    expect(await discardIncompleteSets(workout.id)).toBe(0)

    expect(await listWorkoutSets(workout.id)).toEqual(before)
  })

  it('leaves other workouts alone', async () => {
    const { workout, first } = await twoExercises()
    await addNumbered(first.id, 2)
    // A second, finished workout with its own unticked set.
    await db.workouts.update(workout.id, { status: 'completed' })
    const other = await startWorkout({ now: at(2026, 11, 10, 18) })
    const otherExercise = await addExerciseToWorkout(
      other.id,
      (await makeExercise('Curl')).id,
    )
    const [otherSet] = await addNumbered(otherExercise.id, 1)

    await discardIncompleteSets(workout.id)

    expect((await db.sets.get(otherSet!.id))?.deletedAt).toBeNull()
    expect(await getWorkoutExercise(otherExercise.id)).toBeDefined()
  })

  it('is atomic: a failure leaves every set and exercise in place', async () => {
    const { workout, first } = await twoExercises()
    const sets = await addNumbered(first.id, 2)
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(discardIncompleteSets(workout.id)).rejects.toThrow('disk full')

    expect((await listWorkoutSets(workout.id)).map((s) => s.id)).toEqual(
      sets.map((s) => s.id),
    )
    expect(await getWorkoutExercise(first.id)).toBeDefined()
  })
})

describe('replaceWorkoutExercise', () => {
  it('swaps the exercise on the row and on every set, keeping place and set ids', async () => {
    const { workout, first, second } = await twoExercises()
    const sets = await addNumbered(first.id, 3)
    await deleteSet(sets[0]!.id)
    const newExercise = await makeExercise('Dumbbell Press')
    freezeTime(9_000)

    const replaced = await replaceWorkoutExercise(first.id, newExercise.id)

    expect(replaced).toMatchObject({
      exerciseId: newExercise.id,
      position: 0,
      updatedAt: 9_000,
    })
    // Every set, deleted ones too, so an undo is never stale.
    for (const set of sets) {
      expect(await db.sets.get(set.id)).toMatchObject({
        exerciseId: newExercise.id,
        workoutExerciseId: first.id,
      })
    }
    expect((await listWorkoutExercises(workout.id)).map((e) => e.id)).toEqual([
      first.id,
      second.id,
    ])
  })

  it('leaves the sets of other exercises alone', async () => {
    const { first, second, squat } = await twoExercises()
    await addNumbered(first.id, 1)
    const [other] = await addNumbered(second.id, 1)

    await replaceWorkoutExercise(first.id, (await makeExercise('Press')).id)

    expect((await db.sets.get(other!.id))?.exerciseId).toBe(squat.id)
  })

  it('does nothing when the exercise is the same', async () => {
    const { first, bench } = await twoExercises()
    freezeTime(9_000)

    const result = await replaceWorkoutExercise(first.id, bench.id)

    expect(result.updatedAt).toBe(first.updatedAt)
  })

  it('rejects a missing exercise or workout exercise', async () => {
    const { first } = await twoExercises()

    await expect(replaceWorkoutExercise(first.id, 'nope')).rejects.toThrow(
      'Exercise not found',
    )
    await expect(
      replaceWorkoutExercise('nope', (await makeExercise('Press')).id),
    ).rejects.toThrow('Exercise not found')
  })

  it('is atomic: a failure while updating sets keeps the old exercise', async () => {
    const { first, bench } = await twoExercises()
    const [set] = await addNumbered(first.id, 1)
    const press = await makeExercise('Press')
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(replaceWorkoutExercise(first.id, press.id)).rejects.toThrow(
      'disk full',
    )

    expect((await getWorkoutExercise(first.id))?.exerciseId).toBe(bench.id)
    expect((await db.sets.get(set!.id))?.exerciseId).toBe(bench.id)
  })
})

describe('updateWorkoutExerciseNotes', () => {
  it('stores the notes and sets updatedAt', async () => {
    const { first } = await twoExercises()
    freezeTime(9_000)

    const updated = await updateWorkoutExerciseNotes(first.id, 'felt heavy')

    expect(updated).toMatchObject({ notes: 'felt heavy', updatedAt: 9_000 })
    expect((await getWorkoutExercise(first.id))?.notes).toBe('felt heavy')
  })

  it('rejects an exercise that was removed', async () => {
    const { first } = await twoExercises()
    await removeWorkoutExercise(first.id)

    await expect(updateWorkoutExerciseNotes(first.id, 'x')).rejects.toThrow(
      'Exercise not found',
    )
  })
})

describe('listWorkoutSets and getWorkoutExercise', () => {
  it('lists sets by exercise order and then set order, without deleted ones', async () => {
    const { workout, first, second } = await twoExercises()
    const a = await addNumbered(first.id, 2)
    const b = await addNumbered(second.id, 2)
    await deleteSet(a[0]!.id)

    const sets = await listWorkoutSets(workout.id)

    expect(sets.map((s) => s.id)).toEqual([a[1]!.id, b[0]!.id, b[1]!.id])
  })

  it('follows a reordered workout, and excludes removed exercises and other workouts', async () => {
    const { workout, first, second } = await twoExercises()
    const a = await addNumbered(first.id, 1)
    const b = await addNumbered(second.id, 1)
    await db.workoutExercises.update(first.id, { position: 1 })
    await db.workoutExercises.update(second.id, { position: 0 })

    expect((await listWorkoutSets(workout.id)).map((s) => s.id)).toEqual([
      b[0]!.id,
      a[0]!.id,
    ])

    await removeWorkoutExercise(second.id)
    expect((await listWorkoutSets(workout.id)).map((s) => s.id)).toEqual([
      a[0]!.id,
    ])
    expect(await listWorkoutSets('other-workout')).toEqual([])
  })

  it('hides a deleted workout exercise from getWorkoutExercise', async () => {
    const { workout, first } = await twoExercises()
    expect(await getWorkoutExercise(first.id)).toBeDefined()

    await deleteWorkout(workout.id)

    expect(await getWorkoutExercise(first.id)).toBeUndefined()
  })
})
