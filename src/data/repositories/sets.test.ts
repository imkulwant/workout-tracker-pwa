import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../test/db'
import { at, freezeTime, makeExercise, unfreezeTime } from '../../test/fixtures'
import type { Id, SetType } from '../../domain/types'
import { db } from '../db'
import {
  addSet,
  deleteSet,
  getPreviousPerformance,
  getSet,
  listCountableSets,
  listSets,
  updateSet,
} from './sets'
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  startWorkout,
} from './workouts'

beforeEach(resetDb)
afterEach(() => {
  vi.restoreAllMocks()
  unfreezeTime()
})

async function activeExercise() {
  const exercise = await makeExercise()
  const workout = await startWorkout({ now: at(2026, 11, 9, 18) })
  const row = await addExerciseToWorkout(workout.id, exercise.id)
  return { exercise, workout, row }
}

describe('addSet', () => {
  it('copies the workout, exercise and date onto the set', async () => {
    freezeTime(5_000)
    const { exercise, workout, row } = await activeExercise()

    const set = await addSet(row.id, { weightKg: 82.5, reps: 5 })

    expect(set).toMatchObject({
      workoutId: workout.id,
      workoutExerciseId: row.id,
      exerciseId: exercise.id,
      date: '2026-11-09',
      position: 0,
      type: 'working',
      weightKg: 82.5,
      reps: 5,
      completedAt: null,
      deletedAt: null,
      createdAt: 5_000,
      updatedAt: 5_000,
    })
    expect(await db.sets.get(set.id)).toEqual(set)
  })

  it('numbers sets contiguously from 0', async () => {
    const { row } = await activeExercise()

    await addSet(row.id)
    await addSet(row.id)
    await addSet(row.id)

    expect((await listSets(row.id)).map((s) => s.position)).toEqual([0, 1, 2])
  })

  it('reads a set back unchanged after the database is closed and reopened', async () => {
    const { row } = await activeExercise()
    const set = await addSet(row.id, {
      weightKg: 82.5,
      reps: 5,
      type: 'drop',
      completedAt: 1_794_268_950_000,
    })

    db.close()
    await db.open()

    expect(await getSet(set.id)).toEqual(set)
  })

  it('defaults to a working set with no values', async () => {
    const { row } = await activeExercise()
    const set = await addSet(row.id)
    expect(set).toMatchObject({
      type: 'working',
      weightKg: null,
      reps: null,
      completedAt: null,
    })
  })

  it('accepts reps from 1 to 999 and weights from 0 to 1000', async () => {
    const { row } = await activeExercise()
    for (const [weightKg, reps] of [
      [0, 1],
      [1000, 999],
      [82.5, 5],
    ] as const) {
      await expect(addSet(row.id, { weightKg, reps })).resolves.toBeDefined()
    }
  })

  it('rounds the weight to two decimals', async () => {
    const { row } = await activeExercise()
    expect((await addSet(row.id, { weightKg: 82.456 })).weightKg).toBe(82.46)
    expect((await addSet(row.id, { weightKg: 20.125 })).weightKg).toBe(20.13)
  })

  it.each([0, 1000, 5.5, -1, Number.NaN])(
    'rejects %s reps and writes nothing',
    async (reps) => {
      const { row } = await activeExercise()
      await expect(addSet(row.id, { reps })).rejects.toThrow(/Reps/)
      expect(await db.sets.count()).toBe(0)
    },
  )

  it.each([-0.01, 1000.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s kg and writes nothing',
    async (weightKg) => {
      const { row } = await activeExercise()
      await expect(addSet(row.id, { weightKg })).rejects.toThrow(/Weight/)
      expect(await db.sets.count()).toBe(0)
    },
  )

  it('rejects an unknown set type', async () => {
    const { row } = await activeExercise()
    await expect(addSet(row.id, { type: 'bogus' as never })).rejects.toThrow(
      /Unknown set type/,
    )
  })

  it('rejects a missing or removed workout exercise', async () => {
    await expect(addSet('nope')).rejects.toThrow('Exercise not found')
    const { workout, row } = await activeExercise()
    await deleteWorkout(workout.id)
    await expect(addSet(row.id)).rejects.toThrow('Exercise not found')
  })
})

describe('updateSet', () => {
  it('ticks and unticks a set, and sets updatedAt', async () => {
    freezeTime(1_000)
    const { row } = await activeExercise()
    const set = await addSet(row.id, { weightKg: 80, reps: 5 })
    freezeTime(2_000)

    const ticked = await updateSet(set.id, { completedAt: 1_900 })
    expect(ticked).toMatchObject({
      completedAt: 1_900,
      updatedAt: 2_000,
      createdAt: 1_000,
      weightKg: 80,
      reps: 5,
    })

    freezeTime(3_000)
    const unticked = await updateSet(set.id, { completedAt: null })
    expect(unticked).toMatchObject({ completedAt: null, updatedAt: 3_000 })
  })

  it('can clear a value back to null', async () => {
    const { row } = await activeExercise()
    const set = await addSet(row.id, { weightKg: 80, reps: 5 })

    const cleared = await updateSet(set.id, { weightKg: null })

    expect(cleared).toMatchObject({ weightKg: null, reps: 5 })
  })

  it('applies the same limits as addSet and leaves the row untouched on failure', async () => {
    const { row } = await activeExercise()
    const set = await addSet(row.id, { weightKg: 80, reps: 5 })

    await expect(updateSet(set.id, { reps: 1000 })).rejects.toThrow(/Reps/)
    await expect(updateSet(set.id, { weightKg: -5 })).rejects.toThrow(/Weight/)

    expect(await db.sets.get(set.id)).toEqual(set)
  })

  it('rounds the weight to two decimals', async () => {
    const { row } = await activeExercise()
    const set = await addSet(row.id)
    expect((await updateSet(set.id, { weightKg: 61.234 })).weightKg).toBe(61.23)
  })

  it('cannot update a missing or deleted set', async () => {
    await expect(updateSet('nope', { reps: 5 })).rejects.toThrow(
      'Set not found',
    )
    const { row } = await activeExercise()
    const set = await addSet(row.id)
    await deleteSet(set.id)
    await expect(updateSet(set.id, { reps: 5 })).rejects.toThrow(
      'Set not found',
    )
  })
})

describe('deleteSet', () => {
  async function threeSets() {
    const { row } = await activeExercise()
    const sets = [
      await addSet(row.id, { reps: 1 }),
      await addSet(row.id, { reps: 2 }),
      await addSet(row.id, { reps: 3 }),
    ]
    return { row, sets }
  }

  it('soft-deletes the set, and reads then exclude it', async () => {
    const { row, sets } = await threeSets()
    freezeTime(9_000)

    await deleteSet(sets[1]!.id)

    expect(await db.sets.get(sets[1]!.id)).toMatchObject({
      deletedAt: 9_000,
      updatedAt: 9_000,
    })
    expect(await getSet(sets[1]!.id)).toBeUndefined()
    expect((await listSets(row.id)).map((s) => s.reps)).toEqual([1, 3])
  })

  it.each([
    ['first', 0],
    ['middle', 1],
    ['last', 2],
  ] as const)(
    'keeps positions contiguous after deleting the %s set',
    async (_label, index) => {
      const { row, sets } = await threeSets()

      await deleteSet(sets[index]!.id)

      expect((await listSets(row.id)).map((s) => s.position)).toEqual([0, 1])
    },
  )

  it('keeps the remaining sets in their original order', async () => {
    const { row, sets } = await threeSets()
    await deleteSet(sets[0]!.id)
    expect((await listSets(row.id)).map((s) => s.reps)).toEqual([2, 3])
  })

  it('is atomic: a failure while renumbering keeps the set', async () => {
    const { sets } = await threeSets()
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))

    await expect(deleteSet(sets[0]!.id)).rejects.toThrow('disk full')

    expect(await db.sets.get(sets[0]!.id)).toEqual(sets[0])
  })
})

describe('getPreviousPerformance', () => {
  /** A finished (or still active) session of one exercise. */
  async function session(
    exerciseId: Id,
    startedAt: number,
    sets: { weightKg: number; reps: number; done?: boolean }[],
    options: { finish?: boolean } = {},
  ) {
    const workout = await startWorkout({ now: startedAt })
    const row = await addExerciseToWorkout(workout.id, exerciseId)
    for (const s of sets) {
      await addSet(row.id, {
        weightKg: s.weightKg,
        reps: s.reps,
        completedAt: s.done === false ? null : startedAt + 1_000,
      })
    }
    if (options.finish !== false) {
      await finishWorkout(workout.id, startedAt + 3_600_000)
    }
    return workout
  }

  const day = (d: number) => at(2026, 11, d, 18)

  it('returns the completed sets of the latest earlier session, in order', async () => {
    const exercise = await makeExercise()
    await session(exercise.id, day(2), [{ weightKg: 70, reps: 8 }])
    await session(exercise.id, day(5), [
      { weightKg: 75, reps: 6 },
      { weightKg: 77.5, reps: 5 },
    ])
    const current = await session(exercise.id, day(9), [], { finish: false })

    const previous = await getPreviousPerformance(exercise.id, current.id)

    expect(previous.map((s) => [s.weightKg, s.reps])).toEqual([
      [75, 6],
      [77.5, 5],
    ])
  })

  it('ignores sets that were never ticked', async () => {
    const exercise = await makeExercise()
    await session(exercise.id, day(5), [
      { weightKg: 75, reps: 6 },
      { weightKg: 80, reps: 3, done: false },
    ])
    const current = await session(exercise.id, day(9), [], { finish: false })

    const previous = await getPreviousPerformance(exercise.id, current.id)

    expect(previous.map((s) => s.weightKg)).toEqual([75])
  })

  it('skips a session with no completed sets and uses the one before it', async () => {
    const exercise = await makeExercise()
    await session(exercise.id, day(2), [{ weightKg: 70, reps: 8 }])
    await session(exercise.id, day(5), [{ weightKg: 99, reps: 1, done: false }])
    const current = await session(exercise.id, day(9), [], { finish: false })

    const previous = await getPreviousPerformance(exercise.id, current.id)

    expect(previous.map((s) => s.weightKg)).toEqual([70])
  })

  it('ignores deleted sets and deleted workouts', async () => {
    const exercise = await makeExercise()
    await session(exercise.id, day(2), [{ weightKg: 70, reps: 8 }])
    const deletedWorkout = await session(exercise.id, day(5), [
      { weightKg: 99, reps: 1 },
    ])
    await deleteWorkout(deletedWorkout.id)
    const withDeletedSet = await session(exercise.id, day(7), [
      { weightKg: 71, reps: 8 },
      { weightKg: 88, reps: 2 },
    ])
    const sets = await db.sets
      .where('workoutId')
      .equals(withDeletedSet.id)
      .toArray()
    await deleteSet(sets.find((s) => s.weightKg === 88)!.id)
    const current = await session(exercise.id, day(9), [], { finish: false })

    const previous = await getPreviousPerformance(exercise.id, current.id)

    expect(previous.map((s) => s.weightKg)).toEqual([71])
  })

  it('ignores other exercises', async () => {
    const bench = await makeExercise('Bench Press')
    const squat = await makeExercise('Squat')
    await session(squat.id, day(5), [{ weightKg: 120, reps: 5 }])
    const current = await session(bench.id, day(9), [], { finish: false })

    expect(await getPreviousPerformance(bench.id, current.id)).toEqual([])
  })

  it('ignores sessions that started at or after the current one', async () => {
    const exercise = await makeExercise()
    const earlier = await session(exercise.id, day(5), [
      { weightKg: 75, reps: 6 },
    ])
    await session(exercise.id, day(9), [{ weightKg: 90, reps: 3 }])

    const previous = await getPreviousPerformance(exercise.id, earlier.id)

    expect(previous).toEqual([])
  })

  it('ignores a workout that is still active', async () => {
    const exercise = await makeExercise()
    const earlier = await session(exercise.id, day(5), [
      { weightKg: 75, reps: 6 },
    ])
    const current = await session(exercise.id, day(9), [
      { weightKg: 80, reps: 5 },
    ])
    // Only one workout can be active, so flip the earlier one directly.
    await db.workouts.update(earlier.id, { status: 'active' })

    expect(await getPreviousPerformance(exercise.id, current.id)).toEqual([])
  })

  it('returns nothing when there is no history or the workout is unknown', async () => {
    const exercise = await makeExercise()
    const current = await session(exercise.id, day(9), [], { finish: false })

    expect(await getPreviousPerformance(exercise.id, current.id)).toEqual([])
    expect(await getPreviousPerformance(exercise.id, 'nope')).toEqual([])
  })

  it('returns nothing when the current workout was deleted', async () => {
    const exercise = await makeExercise()
    await session(exercise.id, day(5), [{ weightKg: 75, reps: 6 }])
    const current = await session(exercise.id, day(9), [], { finish: false })
    await deleteWorkout(current.id)

    expect(await getPreviousPerformance(exercise.id, current.id)).toEqual([])
  })
})

describe('listCountableSets', () => {
  const day = (d: number) => at(2026, 11, d, 18)

  /** A finished workout of one exercise; `done: false` leaves a set unticked. */
  async function finished(
    exerciseId: Id,
    startedAt: number,
    sets: { reps: number; done?: boolean; type?: SetType }[],
  ) {
    const workout = await startWorkout({ now: startedAt })
    const row = await addExerciseToWorkout(workout.id, exerciseId)
    const created = []
    for (const [i, s] of sets.entries()) {
      created.push(
        await addSet(row.id, {
          weightKg: 50,
          reps: s.reps,
          type: s.type,
          completedAt: s.done === false ? null : startedAt + 1_000 + i,
        }),
      )
    }
    await finishWorkout(workout.id, startedAt + 3_600_000)
    return { workout, sets: created }
  }

  const repsOf = (sets: { reps: number | null }[]) => sets.map((s) => s.reps)

  it('returns only ticked sets, so an unticked set can never be counted', async () => {
    const exercise = await makeExercise()
    await finished(exercise.id, day(5), [
      { reps: 1 },
      { reps: 2, done: false },
      { reps: 3 },
    ])

    expect(repsOf(await listCountableSets())).toEqual([1, 3])
  })

  it('excludes the sets of a workout that is still active', async () => {
    const exercise = await makeExercise()
    await finished(exercise.id, day(5), [{ reps: 1 }])
    const active = await startWorkout({ now: day(9) })
    const row = await addExerciseToWorkout(active.id, exercise.id)
    await addSet(row.id, { reps: 9, weightKg: 50, completedAt: day(9) })

    expect(repsOf(await listCountableSets())).toEqual([1])
  })

  it('excludes deleted sets and the sets of deleted workouts', async () => {
    const exercise = await makeExercise()
    const kept = await finished(exercise.id, day(2), [{ reps: 1 }, { reps: 2 }])
    await deleteSet(kept.sets[1]!.id)
    const gone = await finished(exercise.id, day(5), [{ reps: 3 }])
    await deleteWorkout(gone.workout.id)

    expect(repsOf(await listCountableSets())).toEqual([1])
  })

  it('keeps warm-up sets, because excluding them is a metric rule', async () => {
    const exercise = await makeExercise()
    await finished(exercise.id, day(5), [
      { reps: 10, type: 'warmup' },
      { reps: 5 },
    ])

    expect(repsOf(await listCountableSets())).toEqual([10, 5])
  })

  it('limits the range by date, inclusive at both ends', async () => {
    const exercise = await makeExercise()
    for (const [d, reps] of [
      [2, 1],
      [5, 2],
      [7, 3],
      [9, 4],
    ] as const) {
      await finished(exercise.id, day(d), [{ reps }])
    }

    expect(
      repsOf(
        await listCountableSets({
          fromDate: '2026-11-05',
          toDate: '2026-11-07',
        }),
      ),
    ).toEqual([2, 3])
    expect(repsOf(await listCountableSets({ fromDate: '2026-11-07' }))).toEqual(
      [3, 4],
    )
    expect(repsOf(await listCountableSets({ toDate: '2026-11-02' }))).toEqual([
      1,
    ])
  })

  it('filters by exercise, alone and together with a date range', async () => {
    const bench = await makeExercise('Bench Press')
    const squat = await makeExercise('Squat')
    await finished(bench.id, day(2), [{ reps: 1 }])
    await finished(squat.id, day(5), [{ reps: 2 }])
    await finished(bench.id, day(9), [{ reps: 3 }])

    expect(repsOf(await listCountableSets({ exerciseId: bench.id }))).toEqual([
      1, 3,
    ])
    expect(
      repsOf(
        await listCountableSets({
          exerciseId: bench.id,
          fromDate: '2026-11-05',
        }),
      ),
    ).toEqual([3])
  })

  it('orders sets by date, then by completion time', async () => {
    const exercise = await makeExercise()
    await finished(exercise.id, day(9), [{ reps: 3 }])
    await finished(exercise.id, day(2), [{ reps: 1 }, { reps: 2 }])

    expect(repsOf(await listCountableSets())).toEqual([1, 2, 3])
  })

  it('returns nothing when there is no data', async () => {
    expect(await listCountableSets()).toEqual([])
  })
})
