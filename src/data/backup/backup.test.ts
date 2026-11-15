import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../test/db'
import { at, makeExercise, unfreezeTime } from '../../test/fixtures'
import { db } from '../db'
import { archiveExercise } from '../repositories/exercises'
import { setSetting } from '../repositories/settings'
import { addSet, deleteSet } from '../repositories/sets'
import { createTemplate } from '../repositories/templates'
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  startWorkout,
  updateWorkout,
} from '../repositories/workouts'
import { buildCsv, csvCell } from './csv'
import { backupFileName, buildBackup, serializeBackup } from './export'
import { mergeBackup, replaceWithBackup, summariseBackup } from './import'
import { parseBackup, type Backup } from './schema'

beforeEach(resetDb)
afterEach(() => {
  vi.restoreAllMocks()
  unfreezeTime()
})

const TABLES = [
  'exercises',
  'workouts',
  'workoutExercises',
  'sets',
  'templates',
  'settings',
] as const

async function snapshot() {
  return Object.fromEntries(
    await Promise.all(
      TABLES.map(async (name) => [name, await db.table(name).toArray()]),
    ),
  )
}

/** Two workouts with sets, a deleted set, a deleted workout, a template and settings. */
async function fill() {
  const bench = await makeExercise('Bench Press')
  const squat = await makeExercise('Squat')
  await archiveExercise(squat.id)

  const first = await startWorkout({ title: 'Push', now: at(2026, 11, 2, 18) })
  const row = await addExerciseToWorkout(first.id, bench.id)
  await addSet(row.id, {
    weightKg: 82.5,
    reps: 5,
    completedAt: at(2026, 11, 2, 18, 20),
  })
  const dropped = await addSet(row.id, { weightKg: 60, reps: 8 })
  await deleteSet(dropped.id)
  await finishWorkout(first.id, at(2026, 11, 2, 19))

  const second = await startWorkout({ title: 'Legs', now: at(2026, 11, 9, 18) })
  const row2 = await addExerciseToWorkout(second.id, bench.id)
  await addSet(row2.id, {
    weightKg: 100,
    reps: 3,
    completedAt: at(2026, 11, 9, 18, 30),
  })
  await finishWorkout(second.id, at(2026, 11, 9, 19))

  const gone = await startWorkout({
    title: 'Mistake',
    now: at(2026, 11, 10, 8),
  })
  await finishWorkout(gone.id, at(2026, 11, 10, 9))
  await deleteWorkout(gone.id)

  await createTemplate({
    name: 'Push A',
    notes: '',
    items: [
      { exerciseId: bench.id, targetSets: 3, targetReps: 8, restSec: 90 },
    ],
  })
  await setSetting('defaultRestSec', 150)
  await setSetting('activeRestTimer', {
    endsAt: 1,
    durationSec: 1,
    workoutExerciseId: row.id,
  })
  return { bench, first, second }
}

const sorted = (rows: unknown[]) =>
  [...rows].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))

describe('buildBackup', () => {
  it('holds every table, deleted rows too, and not the rest timer', async () => {
    await fill()
    const backup = await buildBackup('1.0.0', 123)

    expect(backup).toMatchObject({
      format: 'workout-tracker-backup',
      schemaVersion: 1,
      exportedAt: 123,
      appVersion: '1.0.0',
    })
    expect(backup.data.workouts).toHaveLength(3)
    expect(backup.data.sets.some((s) => s.deletedAt !== null)).toBe(true)
    expect(backup.data.workouts.some((w) => w.deletedAt !== null)).toBe(true)
    expect(backup.data.settings.map((s) => s.key)).toContain('defaultRestSec')
    expect(backup.data.settings.map((s) => s.key)).not.toContain(
      'activeRestTimer',
    )
  })

  it('names the file after the local date', () => {
    expect(backupFileName(at(2026, 11, 15, 23, 30))).toBe(
      'workout-tracker-2026-11-15.json',
    )
  })
})

describe('round trip', () => {
  it('export, clear, import gives back every record', async () => {
    await fill()
    const backup = await buildBackup('1.0.0')
    const before = await snapshot()
    before.settings = before.settings!.filter(
      (row: { key: string }) => row.key !== 'activeRestTimer',
    )

    const text = serializeBackup(backup)
    await resetDb()
    expect((await snapshot()).workouts).toEqual([])

    const parsed = parseBackup(text)
    if (!parsed.ok) throw new Error(parsed.error)
    await replaceWithBackup(parsed.backup)

    const after = await snapshot()
    for (const table of TABLES) {
      expect(sorted(after[table]!), table).toEqual(sorted(before[table]!))
    }
  })

  it('survives a second export of the restored data', async () => {
    await fill()
    const first = await buildBackup('1.0.0', 5)
    await resetDb()
    await replaceWithBackup(first)
    const second = await buildBackup('1.0.0', 5)
    for (const table of TABLES) {
      expect(sorted(second.data[table]), table).toEqual(
        sorted(first.data[table]),
      )
    }
  })
})

describe('parseBackup rejects a malformed file', () => {
  async function valid(): Promise<Backup> {
    await fill()
    return JSON.parse(serializeBackup(await buildBackup('1.0.0'))) as Backup
  }
  const reject = (value: unknown) => parseBackup(JSON.stringify(value))

  it('that is not JSON', () => {
    expect(parseBackup('not json {')).toEqual({
      ok: false,
      error: 'This is not a backup file (it is not JSON).',
    })
    expect(parseBackup('').ok).toBe(false)
  })

  it('that is some other JSON', () => {
    expect(reject({ hello: 'world' }).ok).toBe(false)
    expect(reject([]).ok).toBe(false)
    expect(reject(null).ok).toBe(false)
  })

  it('with another format or a newer schema version', async () => {
    const backup = await valid()
    expect(reject({ ...backup, format: 'other' }).ok).toBe(false)
    expect(reject({ ...backup, schemaVersion: 2 }).ok).toBe(false)
  })

  it('with a missing table or an extra field', async () => {
    const backup = await valid()
    const rest: Record<string, unknown> = { ...backup.data }
    delete rest.sets
    expect(reject({ ...backup, data: rest }).ok).toBe(false)
    expect(reject({ ...backup, extra: 1 }).ok).toBe(false)
    const withExtra = structuredClone(backup)
    ;(withExtra.data.sets[0] as unknown as Record<string, unknown>).oops = 1
    expect(reject(withExtra).ok).toBe(false)
  })

  it.each([
    ['reps of 0', (b: Backup) => void (b.data.sets[0]!.reps = 0)],
    ['reps of 1000', (b: Backup) => void (b.data.sets[0]!.reps = 1000)],
    ['half a rep', (b: Backup) => void (b.data.sets[0]!.reps = 2.5)],
    [
      'a weight over 1000',
      (b: Backup) => void (b.data.sets[0]!.weightKg = 1001),
    ],
    ['a negative weight', (b: Backup) => void (b.data.sets[0]!.weightKg = -1)],
    [
      'an impossible date',
      (b: Backup) => void (b.data.workouts[0]!.date = '2026-02-30'),
    ],
    [
      'a text timestamp',
      (b: Backup) =>
        void ((
          b.data.workouts[0] as unknown as { startedAt: string }
        ).startedAt = 'yesterday'),
    ],
    [
      'an unknown set type',
      (b: Backup) =>
        void ((b.data.sets[0] as unknown as { type: string }).type = 'giant'),
    ],
    [
      'an exercise with no primary muscle',
      (b: Backup) => void (b.data.exercises[0]!.primaryMuscles = []),
    ],
    [
      'an unknown muscle',
      (b: Backup) =>
        void (b.data.exercises[0]!.primaryMuscles = ['wings' as never]),
    ],
    [
      'a setting with the wrong type',
      (b: Backup) => void (b.data.settings[0]!.value = 'x'),
    ],
  ])('with %s', async (_name, break_) => {
    const backup = await valid()
    break_(backup)
    expect(reject(backup).ok).toBe(false)
  })

  it('with a repeated id', async () => {
    const backup = await valid()
    backup.data.workouts.push(structuredClone(backup.data.workouts[0]!))
    expect(reject(backup)).toMatchObject({ ok: false })
  })

  it('with a set that points at a missing exercise row', async () => {
    const backup = await valid()
    backup.data.sets[0]!.workoutExerciseId = 'nowhere'
    expect(reject(backup)).toMatchObject({
      ok: false,
      error: expect.stringContaining('inconsistent'),
    })
  })

  it('with a rest timer in the settings', async () => {
    const backup = await valid()
    backup.data.settings.push({
      key: 'activeRestTimer',
      value: null,
      updatedAt: 1,
    })
    expect(reject(backup).ok).toBe(false)
  })

  it('and parsing writes nothing', async () => {
    const backup = await valid()
    const before = await snapshot()
    backup.data.sets[0]!.reps = 0
    reject(backup)
    expect(await snapshot()).toEqual(before)
  })
})

describe('replaceWithBackup', () => {
  it('changes nothing when a write fails halfway', async () => {
    await fill()
    const backup = await buildBackup('1.0.0')
    await db.exercises.clear()
    await makeExercise('Only this')
    const before = await snapshot()

    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))
    await expect(replaceWithBackup(backup)).rejects.toThrow('disk full')

    expect(await snapshot()).toEqual(before)
  })

  it('removes what the backup does not hold, including a workout in progress', async () => {
    const backup = await buildBackup('1.0.0')
    await makeExercise('New one')
    await startWorkout()

    await replaceWithBackup(backup)

    expect(await db.exercises.count()).toBe(0)
    expect(await db.workouts.count()).toBe(0)
  })
})

describe('mergeBackup', () => {
  it('adds rows that are missing', async () => {
    await fill()
    const backup = await buildBackup('1.0.0')
    await resetDb()
    await makeExercise('Kept')

    await mergeBackup(backup)

    expect(await db.workouts.count()).toBe(3)
    expect((await db.exercises.toArray()).some((e) => e.name === 'Kept')).toBe(
      true,
    )
  })

  it('keeps the newer row, and the stored one on a tie', async () => {
    const { first, second } = await fill()
    const backup = await buildBackup('1.0.0')
    const stored = await db.workouts.get(first.id)

    // Stored is newer for `first`, equal for `second`, older for the third.
    await db.workouts.put({
      ...stored!,
      title: 'Stored newer',
      updatedAt: stored!.updatedAt + 100,
    })
    const secondStored = await db.workouts.get(second.id)
    await db.workouts.put({ ...secondStored!, title: 'Stored tie' })
    const incomingTie = backup.data.workouts.find((w) => w.id === second.id)!
    incomingTie.updatedAt = (await db.workouts.get(second.id))!.updatedAt
    incomingTie.title = 'Incoming tie'
    const third = backup.data.workouts.find((w) => w.title === 'Mistake')!
    third.title = 'Incoming newer'
    third.updatedAt += 1_000_000
    third.deletedAt = null

    await mergeBackup(backup)

    expect((await db.workouts.get(first.id))?.title).toBe('Stored newer')
    expect((await db.workouts.get(second.id))?.title).toBe('Stored tie')
    expect((await db.workouts.get(third.id))?.title).toBe('Incoming newer')
  })

  it('does not bring back the rest timer, and keeps a newer setting', async () => {
    await fill()
    const backup = await buildBackup('1.0.0')
    const restSetting = backup.data.settings.find(
      (s) => s.key === 'defaultRestSec',
    )!
    await setSetting('defaultRestSec', 45)
    restSetting.updatedAt = 0

    await mergeBackup(backup)

    expect((await db.settings.get('defaultRestSec'))?.value).toBe(45)
  })

  it('changes nothing when a write fails halfway', async () => {
    await fill()
    const backup = await buildBackup('1.0.0')
    await resetDb()
    const before = await snapshot()
    vi.spyOn(db.sets, 'bulkPut').mockRejectedValueOnce(new Error('boom'))

    await expect(mergeBackup(backup)).rejects.toThrow('boom')

    expect(await snapshot()).toEqual(before)
  })

  it('updates a date edited on the other side, with its sets', async () => {
    const { first } = await fill()
    const backup = await buildBackup('1.0.0')
    await updateWorkout(first.id, { date: '2026-10-01' })
    // The stored copy is newer, so merging the old backup leaves it alone.
    await mergeBackup(backup)
    expect((await db.workouts.get(first.id))?.date).toBe('2026-10-01')
    expect(
      (await db.sets.where('workoutId').equals(first.id).first())?.date,
    ).toBe('2026-10-01')
  })
})

describe('summariseBackup', () => {
  it('counts live rows and gives the date range', async () => {
    await fill()
    const summary = summariseBackup(await buildBackup('1.0.0', 99))
    expect(summary).toMatchObject({
      exercises: 2,
      workouts: 2,
      sets: 2,
      templates: 1,
      firstDate: '2026-11-02',
      lastDate: '2026-11-09',
      exportedAt: 99,
      appVersion: '1.0.0',
    })
  })

  it('has no date range for an empty backup', async () => {
    const summary = summariseBackup(await buildBackup('1.0.0'))
    expect(summary).toMatchObject({
      workouts: 0,
      firstDate: null,
      lastDate: null,
    })
  })
})

describe('csv', () => {
  it('escapes quotes, commas and line breaks, and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('@sum')).toBe("'@sum")
    expect(csvCell(82.5)).toBe('82.5')
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(null)).toBe('')
  })

  it('has one row per completed set, in the order they were done', async () => {
    await fill()
    const csv = await buildCsv()
    expect(csv.split('\r\n')).toEqual([
      'date,workout,exercise,set,type,kg,reps',
      '2026-11-02,Push,Bench Press,1,working,82.5,5',
      '2026-11-09,Legs,Bench Press,1,working,100,3',
      '',
    ])
  })

  it('leaves out unticked and deleted sets', async () => {
    const bench = await makeExercise('Bench Press')
    const workout = await startWorkout({ now: at(2026, 11, 2, 18) })
    const row = await addExerciseToWorkout(workout.id, bench.id)
    await addSet(row.id, { weightKg: 50, reps: 5 })
    const gone = await addSet(row.id, {
      weightKg: 60,
      reps: 5,
      completedAt: at(2026, 11, 2, 18, 5),
    })
    await deleteSet(gone.id)
    expect(await buildCsv()).toBe('date,workout,exercise,set,type,kg,reps\r\n')
  })

  it('shows a bodyweight set with no added weight as an empty kg', async () => {
    const pullUp = await makeExercise('Pull-up')
    const workout = await startWorkout({
      title: 'A "quoted", title',
      now: at(2026, 11, 2, 18),
    })
    const row = await addExerciseToWorkout(workout.id, pullUp.id)
    await addSet(row.id, { reps: 8, completedAt: at(2026, 11, 2, 18, 5) })
    expect((await buildCsv()).split('\r\n')[1]).toBe(
      '2026-11-02,"A ""quoted"", title",Pull-up,1,working,,8',
    )
  })
})
