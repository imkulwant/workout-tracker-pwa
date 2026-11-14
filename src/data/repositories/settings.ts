import type { EpochMs, Id } from '../../domain/types'
import { db } from '../db'

export interface ActiveRestTimer {
  endsAt: EpochMs
  durationSec: number
  workoutExerciseId: Id
}

export type CalendarMetric = 'sets' | 'volume' | 'duration'

export interface SettingValues {
  defaultRestSec: number
  wakeLockEnabled: boolean
  restSoundEnabled: boolean
  calendarMetric: CalendarMetric
  lastBackupAt: EpochMs | null
  activeRestTimer: ActiveRestTimer | null
  seedVersion: number | null
}

export type SettingKey = keyof SettingValues

export const SETTING_DEFAULTS: SettingValues = {
  defaultRestSec: 120,
  wakeLockEnabled: true,
  restSoundEnabled: true,
  calendarMetric: 'sets',
  lastBackupAt: null,
  activeRestTimer: null,
  seedVersion: null,
}

/** The stored value, or the default when the setting was never written. */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValues[K]> {
  const row = await db.settings.get(key)
  return row ? (row.value as SettingValues[K]) : SETTING_DEFAULTS[key]
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingValues[K],
): Promise<void> {
  await db.settings.put({ key, value, updatedAt: Date.now() })
}

/** Removes the stored value, so reads fall back to the default. */
export async function clearSetting(key: SettingKey): Promise<void> {
  await db.settings.delete(key)
}
