import { describe, expect, it } from 'vitest'
import { backupReminder } from './backupReminder'

const DAY = 86_400_000
const now = 100 * DAY

describe('backupReminder', () => {
  it('does not nag when nothing has been completed', () => {
    expect(
      backupReminder({ completedWorkouts: 0, lastBackupAt: null, now }),
    ).toEqual({ overdue: false, daysSince: null })
  })

  it('nags when there is data and no backup was ever saved', () => {
    expect(
      backupReminder({ completedWorkouts: 1, lastBackupAt: null, now }),
    ).toEqual({ overdue: true, daysSince: null })
  })

  it('is fine up to and including 14 days, and overdue after', () => {
    const at = (days: number) =>
      backupReminder({
        completedWorkouts: 3,
        lastBackupAt: now - days * DAY,
        now,
      })
    expect(at(0)).toEqual({ overdue: false, daysSince: 0 })
    expect(at(14)).toEqual({ overdue: false, daysSince: 14 })
    expect(
      backupReminder({
        completedWorkouts: 3,
        lastBackupAt: now - 14 * DAY - 1,
        now,
      }).overdue,
    ).toBe(true)
    expect(at(15)).toEqual({ overdue: true, daysSince: 15 })
  })

  it('counts whole days, and never goes negative', () => {
    expect(
      backupReminder({
        completedWorkouts: 1,
        lastBackupAt: now - 2.9 * DAY,
        now,
      }).daysSince,
    ).toBe(2)
    expect(
      backupReminder({ completedWorkouts: 1, lastBackupAt: now + 5, now })
        .daysSince,
    ).toBe(0)
  })
})
