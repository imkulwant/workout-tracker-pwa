import { APP_VERSION } from '../../app/version'
import { buildCsv, csvFileName } from '../../data/backup/csv'
import {
  backupFileName,
  buildBackup,
  serializeBackup,
} from '../../data/backup/export'
import { setSetting } from '../../data/repositories/settings'
import { toLocalDate } from '../../domain/dates'

/** The whole database as a `.json` file, ready to hand to the user. */
export async function makeBackupFile(now: number = Date.now()): Promise<File> {
  const backup = await buildBackup(APP_VERSION, now)
  return new File([serializeBackup(backup)], backupFileName(now), {
    type: 'application/json',
  })
}

/** Every completed set as a `.csv` file. */
export async function makeCsvFile(now: number = Date.now()): Promise<File> {
  return new File([await buildCsv()], csvFileName(toLocalDate(now)), {
    type: 'text/csv',
  })
}

/** Remembers that a backup reached the user, for the overdue reminder. */
export function recordBackupSaved(now: number = Date.now()): Promise<void> {
  return setSetting('lastBackupAt', now)
}
