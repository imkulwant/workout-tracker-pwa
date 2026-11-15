import type { EpochMs } from './types'

/** A backup older than this, or none at all, is overdue. */
export const BACKUP_OVERDUE_DAYS = 14

const DAY_MS = 86_400_000

export interface BackupReminder {
  /** Whether Today should nag. */
  overdue: boolean
  /** Whole days since the last backup, or null if there never was one. */
  daysSince: number | null
}

/**
 * Nags only when there is something to lose: at least one completed workout.
 * "More than 14 days" means a backup exactly 14 days old is still fine.
 */
export function backupReminder(options: {
  completedWorkouts: number
  lastBackupAt: EpochMs | null
  now: EpochMs
}): BackupReminder {
  const { completedWorkouts, lastBackupAt, now } = options
  const daysSince =
    lastBackupAt === null
      ? null
      : Math.max(0, Math.floor((now - lastBackupAt) / DAY_MS))
  if (completedWorkouts === 0) return { overdue: false, daysSince }
  const overdue =
    lastBackupAt === null || now - lastBackupAt > BACKUP_OVERDUE_DAYS * DAY_MS
  return { overdue, daysSince }
}
