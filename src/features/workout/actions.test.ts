import { beforeEach, describe, expect, it } from 'vitest'
import { InvariantError } from '../../data/repositories/common'
import { updateExercise } from '../../data/repositories/exercises'
import { getSetting, setSetting } from '../../data/repositories/settings'
import { listSets, addSet, updateSet } from '../../data/repositories/sets'
import {
  addExerciseToWorkout,
  deleteWorkout,
  getWorkout,
  finishWorkout,
  listWorkoutExercises,
  removeWorkoutExercise,
  startWorkout,
} from '../../data/repositories/workouts'
import { resetDb } from '../../test/db'
import { at, makeExercise } from '../../test/fixtures'
import {
  addExercisesToWorkout,
  addSetToExercise,
  discardWorkout,
  finishAtLastSet,
  startRestAfterSet,
} from './actions'

beforeEach(resetDb)

const values = async (workoutExerciseId: string) =>
  (await listSets(workoutExerciseId)).map((s) => [s.weightKg, s.reps])

/** A finished workout where `sets` were done, each as [weightKg, reps, ticked]. */
async function pastSession(
  exerciseId: string,
  day: number,
  sets: [number, number, boolean?][],
) {
  const workout = await startWorkout({ now: at(2026, 11, day, 18) })
  const row = await addExerciseToWorkout(workout.id, exerciseId)
  for (const [weightKg, reps, ticked = true] of sets) {
    await addSet(row.id, {
      weightKg,
      reps,
      completedAt: ticked ? at(2026, 11, day, 18, 30) : null,
    })
  }
  await finishWorkout(workout.id, at(2026, 11, day, 19))
  return workout
}

describe('addSetToExercise', () => {
  it('starts empty for an exercise with no history', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout()
    const row = await addExerciseToWorkout(workout.id, bench.id)

    const set = await addSetToExercise(row.id)

    expect(set).toMatchObject({
      weightKg: null,
      reps: null,
      type: 'working',
      completedAt: null,
      position: 0,
    })
  })

  it('copies the row above when there is no history', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout()
    const row = await addExerciseToWorkout(workout.id, bench.id)
    const first = await addSetToExercise(row.id)
    await updateSet(first.id, { weightKg: 82.5, reps: 6, completedAt: 1 })

    const second = await addSetToExercise(row.id)

    expect(second).toMatchObject({
      weightKg: 82.5,
      reps: 6,
      completedAt: null,
      position: 1,
    })
  })

  it('starts each position from the same position in the last session', async () => {
    const bench = await makeExercise('Bench Press')
    await pastSession(bench.id, 2, [
      [80, 5],
      [85, 5],
      [90, 3],
    ])
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)

    await addSetToExercise(row.id)
    await addSetToExercise(row.id)
    await addSetToExercise(row.id)

    expect(await values(row.id)).toEqual([
      [80, 5],
      [85, 5],
      [90, 3],
    ])
  })

  it('prefers the last session over the row above', async () => {
    const bench = await makeExercise('Bench Press')
    await pastSession(bench.id, 2, [
      [80, 5],
      [85, 5],
    ])
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)
    const first = await addSetToExercise(row.id)
    await updateSet(first.id, { weightKg: 60, reps: 10 })

    const second = await addSetToExercise(row.id)

    expect(second).toMatchObject({ weightKg: 85, reps: 5 })
  })

  it('copies the row above once past the last session', async () => {
    const bench = await makeExercise('Bench Press')
    await pastSession(bench.id, 2, [[80, 5]])
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)
    await addSetToExercise(row.id) // 80 x 5, from the session
    const second = await addSetToExercise(row.id) // past the session

    expect(second).toMatchObject({ weightKg: 80, reps: 5 })
  })

  it('counts only the sets that were ticked last time', async () => {
    const bench = await makeExercise('Bench Press')
    await pastSession(bench.id, 2, [
      [80, 5],
      [999, 1, false], // never ticked, so it is not "the second set"
      [85, 5],
    ])
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)

    await addSetToExercise(row.id)
    await addSetToExercise(row.id)

    expect(await values(row.id)).toEqual([
      [80, 5],
      [85, 5],
    ])
  })

  it('ignores a session in a deleted workout', async () => {
    const bench = await makeExercise('Bench Press')
    const gone = await pastSession(bench.id, 5, [[200, 1]])
    await deleteWorkout(gone.id)
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)

    const set = await addSetToExercise(row.id)

    expect(set).toMatchObject({ weightKg: null, reps: null })
  })

  it('keeps positions contiguous as sets are added', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout()
    const row = await addExerciseToWorkout(workout.id, bench.id)

    for (let i = 0; i < 4; i++) await addSetToExercise(row.id)

    expect((await listSets(row.id)).map((s) => s.position)).toEqual([
      0, 1, 2, 3,
    ])
  })

  it('rejects an exercise that is not in the workout any more', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout()
    const row = await addExerciseToWorkout(workout.id, bench.id)
    await removeWorkoutExercise(row.id)

    await expect(addSetToExercise(row.id)).rejects.toThrow(InvariantError)
    await expect(addSetToExercise('nope')).rejects.toThrow('Exercise not found')
  })
})

describe('addExercisesToWorkout', () => {
  it('adds each exercise in order with one first set', async () => {
    const bench = await makeExercise('Bench Press')
    const squat = await makeExercise('Squat')
    const workout = await startWorkout()

    await addExercisesToWorkout(workout.id, [squat, bench])

    const rows = await listWorkoutExercises(workout.id)
    expect(rows.map((r) => [r.exerciseId, r.position])).toEqual([
      [squat.id, 0],
      [bench.id, 1],
    ])
    for (const row of rows) expect(await listSets(row.id)).toHaveLength(1)
  })

  it('prefills the first set from the last session', async () => {
    const bench = await makeExercise('Bench Press')
    await pastSession(bench.id, 2, [[80, 5]])
    const workout = await startWorkout({ now: at(2026, 11, 9, 18) })

    await addExercisesToWorkout(workout.id, [bench])

    const [row] = await listWorkoutExercises(workout.id)
    expect(await values(row!.id)).toEqual([[80, 5]])
  })

  it('does nothing for an empty list', async () => {
    const workout = await startWorkout()

    await addExercisesToWorkout(workout.id, [])

    expect(await listWorkoutExercises(workout.id)).toEqual([])
  })

  it('rejects an unknown workout', async () => {
    const bench = await makeExercise('Bench Press')

    await expect(addExercisesToWorkout('nope', [bench])).rejects.toThrow(
      'Workout not found',
    )
  })
})

describe('startRestAfterSet', () => {
  async function aSet(type: 'working' | 'warmup', restSec: number | null) {
    const bench = await makeExercise('Bench Press')
    if (restSec !== null)
      await updateExercise(bench.id, { defaultRestSec: restSec })
    const workout = await startWorkout({ now: at(2026, 11, 10, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)
    const set = await addSet(row.id, { weightKg: 60, reps: 5, type })
    return { row, set }
  }

  it('uses the global default when the exercise has no rest of its own', async () => {
    const { row, set } = await aSet('working', null)
    await startRestAfterSet(set, 1_000_000)
    expect(await getSetting('activeRestTimer')).toEqual({
      endsAt: 1_000_000 + 120_000,
      durationSec: 120,
      workoutExerciseId: row.id,
    })
  })

  it('prefers the exercise rest over the global default', async () => {
    const { set } = await aSet('working', 90)
    await setSetting('defaultRestSec', 180)
    await startRestAfterSet(set, 0)
    expect((await getSetting('activeRestTimer'))?.durationSec).toBe(90)
  })

  it('does not start a timer for a warm-up set', async () => {
    const { set } = await aSet('warmup', null)
    await startRestAfterSet(set, 0)
    expect(await getSetting('activeRestTimer')).toBeNull()
  })

  it('replaces a running timer', async () => {
    const { set } = await aSet('working', 60)
    await startRestAfterSet(set, 0)
    await startRestAfterSet(set, 30_000)
    expect((await getSetting('activeRestTimer'))?.endsAt).toBe(90_000)
  })
})

describe('finishAtLastSet', () => {
  it('ends the workout at its latest completed set and stops the rest timer', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout({ now: at(2026, 11, 10, 8) })
    const row = await addExerciseToWorkout(workout.id, bench.id)
    await addSet(row.id, {
      weightKg: 60,
      reps: 5,
      completedAt: at(2026, 11, 10, 8, 40),
    })
    await addSet(row.id, {
      weightKg: 60,
      reps: 5,
      completedAt: at(2026, 11, 10, 9, 10),
    })
    await addSet(row.id, { weightKg: 60, reps: 5 })
    await setSetting('activeRestTimer', {
      endsAt: 1,
      durationSec: 1,
      workoutExerciseId: row.id,
    })

    expect(await finishAtLastSet(workout.id)).toBe(true)

    const finished = await getWorkout(workout.id)
    expect(finished?.status).toBe('completed')
    expect(finished?.endedAt).toBe(at(2026, 11, 10, 9, 10))
    expect(await getSetting('activeRestTimer')).toBeNull()
  })

  it('leaves a workout with no completed set untouched', async () => {
    const workout = await startWorkout({ now: at(2026, 11, 10, 8) })
    expect(await finishAtLastSet(workout.id)).toBe(false)
    expect((await getWorkout(workout.id))?.status).toBe('active')
  })
})

describe('discardWorkout', () => {
  it('deletes the workout and stops the rest timer', async () => {
    const workout = await startWorkout({ now: at(2026, 11, 10, 8) })
    await setSetting('activeRestTimer', {
      endsAt: 1,
      durationSec: 1,
      workoutExerciseId: 'x',
    })
    await discardWorkout(workout.id)
    expect(await getWorkout(workout.id)).toBeUndefined()
    expect(await getSetting('activeRestTimer')).toBeNull()
  })
})
