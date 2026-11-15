import { afterEach, describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../domain/types'
import { WorkoutDb } from './db'

const opened: WorkoutDb[] = []
async function open(name: string) {
  const instance = new WorkoutDb(name)
  opened.push(instance)
  await instance.open()
  return instance
}

afterEach(async () => {
  for (const instance of opened.splice(0)) {
    instance.close()
    await instance.delete()
  }
})

describe('schema version 1', () => {
  it('has the six tables from the plan at version 1', async () => {
    const db = await open('schema-test')
    expect(db.verno).toBe(1)
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'exercises',
      'sets',
      'settings',
      'templates',
      'workoutExercises',
      'workouts',
    ])
  })

  it('keys settings by key and everything else by id', async () => {
    const db = await open('keys-test')
    expect(db.settings.schema.primKey.name).toBe('key')
    for (const table of [
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.sets,
      db.templates,
    ]) {
      expect(table.schema.primKey.name).toBe('id')
    }
  })

  it('indexes sets for progress and heatmap queries without joins', async () => {
    const db = await open('index-test')
    const indexes = db.sets.schema.indexes.map((i) => i.src).sort()
    expect(indexes).toEqual(
      [
        'workoutId',
        'workoutExerciseId',
        'exerciseId',
        'date',
        '[exerciseId+date]',
        'updatedAt',
      ].sort(),
    )
    expect(db.sets.schema.idxByName['[exerciseId+date]']?.compound).toBe(true)
  })

  it('indexes the other tables as in the plan', async () => {
    const db = await open('other-index-test')
    const names = (table: { schema: { indexes: { src: string }[] } }) =>
      table.schema.indexes.map((i) => i.src).sort()
    expect(names(db.exercises)).toEqual(['nameKey', 'updatedAt'])
    expect(names(db.workouts)).toEqual(
      ['date', 'startedAt', 'status', 'updatedAt'].sort(),
    )
    expect(names(db.workoutExercises)).toEqual(
      ['exerciseId', 'updatedAt', 'workoutId'].sort(),
    )
    expect(names(db.templates)).toEqual(['name', 'updatedAt'])
    expect(names(db.settings)).toEqual([])
  })
})

describe('persistence', () => {
  it('reads a set back unchanged after closing and reopening the database', async () => {
    const set: WorkoutSet = {
      id: '7b0f3c1e-0000-4000-8000-000000000001',
      createdAt: 1_794_268_800_000,
      updatedAt: 1_794_268_900_000,
      deletedAt: null,
      workoutId: 'w1',
      workoutExerciseId: 'we1',
      exerciseId: 'seed-barbell-bench-press',
      date: '2026-11-09',
      position: 0,
      type: 'working',
      weightKg: 82.5,
      reps: 5,
      completedAt: 1_794_268_950_000,
    }
    const first = await open('reopen-test')
    await first.sets.put(set)
    first.close()

    const reopened = await open('reopen-test')
    expect(await reopened.sets.get(set.id)).toEqual(set)
  })

  it('keeps null fields as null', async () => {
    const first = await open('null-test')
    await first.settings.put({ key: 'lastBackupAt', value: null, updatedAt: 1 })
    first.close()

    const reopened = await open('null-test')
    expect(await reopened.settings.get('lastBackupAt')).toEqual({
      key: 'lastBackupAt',
      value: null,
      updatedAt: 1,
    })
  })
})
