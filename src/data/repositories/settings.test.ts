import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../../test/db'
import { freezeTime, unfreezeTime } from '../../test/fixtures'
import { db } from '../db'
import {
  SETTING_DEFAULTS,
  clearSetting,
  getSetting,
  setSetting,
} from './settings'

beforeEach(resetDb)
afterEach(unfreezeTime)

describe('settings', () => {
  it('returns the plan defaults before anything is stored', async () => {
    expect(await getSetting('defaultRestSec')).toBe(120)
    expect(await getSetting('wakeLockEnabled')).toBe(true)
    expect(await getSetting('restSoundEnabled')).toBe(true)
    expect(await getSetting('calendarMetric')).toBe('sets')
    expect(await getSetting('lastBackupAt')).toBeNull()
    expect(await getSetting('activeRestTimer')).toBeNull()
    expect(SETTING_DEFAULTS.seedVersion).toBeNull()
  })

  it('stores a value with updatedAt and reads it back', async () => {
    freezeTime(4_000)

    await setSetting('defaultRestSec', 90)

    expect(await getSetting('defaultRestSec')).toBe(90)
    expect(await db.settings.get('defaultRestSec')).toEqual({
      key: 'defaultRestSec',
      value: 90,
      updatedAt: 4_000,
    })
  })

  it('keeps a stored false instead of falling back to the default true', async () => {
    await setSetting('wakeLockEnabled', false)
    expect(await getSetting('wakeLockEnabled')).toBe(false)
  })

  it('overwrites a previous value and moves updatedAt', async () => {
    freezeTime(1_000)
    await setSetting('calendarMetric', 'volume')
    freezeTime(2_000)
    await setSetting('calendarMetric', 'duration')

    expect(await getSetting('calendarMetric')).toBe('duration')
    expect((await db.settings.get('calendarMetric'))?.updatedAt).toBe(2_000)
  })

  it('round-trips the rest timer object', async () => {
    const timer = {
      endsAt: 1_794_268_800_000,
      durationSec: 120,
      workoutExerciseId: 'we-1',
    }

    await setSetting('activeRestTimer', timer)

    expect(await getSetting('activeRestTimer')).toEqual(timer)
  })

  it('falls back to the default after a setting is cleared', async () => {
    await setSetting('defaultRestSec', 90)
    await clearSetting('defaultRestSec')

    expect(await getSetting('defaultRestSec')).toBe(120)
    expect(await db.settings.get('defaultRestSec')).toBeUndefined()
  })
})
