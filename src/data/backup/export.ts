import { toLocalDate } from '../../domain/dates'
import { db } from '../db'
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, type Backup } from './schema'

/**
 * Everything the app stores, as one object: every table, soft-deleted rows
 * included, so a restore brings back exactly what was there. The running rest
 * timer is left out, because it means nothing on another day.
 */
export async function buildBackup(
  appVersion: string,
  now: number = Date.now(),
): Promise<Backup> {
  const data = await db.transaction(
    'r',
    [
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.sets,
      db.templates,
      db.settings,
    ],
    async () => ({
      exercises: await db.exercises.toArray(),
      workouts: await db.workouts.toArray(),
      workoutExercises: await db.workoutExercises.toArray(),
      sets: await db.sets.toArray(),
      templates: await db.templates.toArray(),
      settings: (await db.settings.toArray()).filter(
        (setting) => setting.key !== 'activeRestTimer',
      ),
    }),
  )
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    appVersion,
    data: data as Backup['data'],
  }
}

export const serializeBackup = (backup: Backup): string =>
  JSON.stringify(backup)

/** `workout-tracker-2026-11-15.json`, dated on the device's clock. */
export function backupFileName(now: number = Date.now()): string {
  return `workout-tracker-${toLocalDate(now)}.json`
}
