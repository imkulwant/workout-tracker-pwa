import type { EntityTable } from 'dexie'
import type { Entity, Setting } from '../../domain/types'
import { db } from '../db'
import type { Backup } from './schema'

export interface BackupSummary {
  exercises: number
  workouts: number
  sets: number
  templates: number
  /** The first and last workout date, or null if there are no workouts. */
  firstDate: string | null
  lastDate: string | null
  exportedAt: number
  appVersion: string
}

/** What a file holds, shown before anything is written. Deleted rows are not counted. */
export function summariseBackup(backup: Backup): BackupSummary {
  const live = <T extends { deletedAt: number | null }>(rows: readonly T[]) =>
    rows.filter((row) => row.deletedAt === null)
  const workouts = live(backup.data.workouts)
  const dates = workouts.map((w) => w.date).sort()
  return {
    exercises: live(backup.data.exercises).length,
    workouts: workouts.length,
    sets: live(backup.data.sets).length,
    templates: live(backup.data.templates).length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
  }
}

const ALL_TABLES = () => [
  db.exercises,
  db.workouts,
  db.workoutExercises,
  db.sets,
  db.templates,
  db.settings,
]

/** Puts the rows that are new or newer than what is stored. Returns how many it wrote. */
async function putNewer<T extends Entity>(
  table: EntityTable<T, 'id'>,
  incoming: readonly T[],
): Promise<number> {
  // Entity ids are strings, which Dexie's generic key type cannot see here.
  const ids = incoming.map((row) => row.id) as Parameters<
    typeof table.bulkGet
  >[0]
  const existing = await table.bulkGet(ids)
  const winners = incoming.filter((row, i) => {
    const current = existing[i]
    return !current || row.updatedAt > current.updatedAt
  })
  await table.bulkPut(winners)
  return winners.length
}

/**
 * Adds a backup to what is stored. For a row in both, the one with the newer
 * `updatedAt` wins, and a tie keeps the stored row. One transaction: if any
 * write fails, nothing changes. Returns how many rows were written.
 */
export async function mergeBackup(backup: Backup): Promise<number> {
  return db.transaction('rw', ALL_TABLES(), async () => {
    const { data } = backup
    let written = 0
    written += await putNewer(db.exercises, data.exercises)
    written += await putNewer(db.workouts, data.workouts)
    written += await putNewer(db.workoutExercises, data.workoutExercises)
    written += await putNewer(db.sets, data.sets)
    written += await putNewer(db.templates, data.templates)

    const keys = data.settings.map((s) => s.key)
    const stored = await db.settings.bulkGet(keys)
    const newer = data.settings.filter(
      (setting: Setting, i) =>
        !stored[i] || setting.updatedAt > stored[i]!.updatedAt,
    )
    await db.settings.bulkPut(newer)
    return written + newer.length
  })
}

/**
 * Swaps everything stored for the contents of a backup, in one transaction.
 * A workout in progress and a running rest timer go with the old data.
 */
export async function replaceWithBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    for (const table of ALL_TABLES()) await table.clear()
    const { data } = backup
    await db.exercises.bulkPut(data.exercises)
    await db.workouts.bulkPut(data.workouts)
    await db.workoutExercises.bulkPut(data.workoutExercises)
    await db.sets.bulkPut(data.sets)
    await db.templates.bulkPut(data.templates)
    await db.settings.bulkPut(data.settings)
  })
}
