import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listExercises } from '../data/repositories/exercises'
import * as seed from '../data/seed'
import { resetDb } from '../test/db'
import {
  startWorkout,
  finishWorkout,
  deleteWorkout,
} from '../data/repositories/workouts'
import { HAD_DATA_KEY } from '../platform/dataMarker'
import { bootstrap, finishRestore } from './bootstrap'

beforeEach(resetDb)
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const seededCount = async () =>
  (await listExercises({ includeArchived: true })).length

function stubStorage(storage: unknown) {
  vi.stubGlobal('navigator', { storage })
}

describe('bootstrap', () => {
  it('asks for persistent storage and seeds the library at launch', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => false, persist })

    await bootstrap()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(await seededCount()).toBe(46)
  })

  it('does not ask again once storage is already persistent', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => true, persist })

    await bootstrap()

    expect(persist).not.toHaveBeenCalled()
  })

  it('still seeds when persistence is refused or throws', async () => {
    stubStorage({
      persisted: async () => false,
      persist: async () => {
        throw new Error('not allowed')
      },
    })

    await bootstrap()

    expect(await seededCount()).toBe(46)
  })

  it('still seeds on a browser with no storage manager', async () => {
    stubStorage(undefined)

    await bootstrap()

    expect(await seededCount()).toBe(46)
  })

  it('seeds only once across launches', async () => {
    stubStorage({ persisted: async () => true })

    await bootstrap()
    await bootstrap()

    expect(await seededCount()).toBe(46)
  })

  it('rejects when storage cannot be opened, so the app can report it', async () => {
    stubStorage({ persisted: async () => true })
    vi.spyOn(seed, 'seedIfNeeded').mockRejectedValueOnce(
      new Error('storage unavailable'),
    )

    await expect(bootstrap()).rejects.toThrow('storage unavailable')
  })
})

describe('bootstrap and lost data', () => {
  function stubLocalStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    })
    return items
  }

  it('asks for a restore, and seeds nothing, when the marker is set and the database is empty', async () => {
    stubLocalStorage({ [HAD_DATA_KEY]: '1' })

    expect(await bootstrap()).toEqual({ needsRestore: true })
    expect(await seededCount()).toBe(0)
  })

  it('seeds after the restore screen is done', async () => {
    stubLocalStorage({ [HAD_DATA_KEY]: '1' })
    await bootstrap()
    await finishRestore()
    expect(await seededCount()).toBe(46)
  })

  it('does not ask for a restore on a first launch', async () => {
    stubLocalStorage()
    expect(await bootstrap()).toEqual({ needsRestore: false })
    expect(await seededCount()).toBe(46)
  })

  it('sets the marker once a workout has been completed', async () => {
    const items = stubLocalStorage()
    await bootstrap()
    expect(items.has(HAD_DATA_KEY)).toBe(false)

    const workout = await startWorkout()
    await finishWorkout(workout.id)
    await bootstrap()
    expect(items.get(HAD_DATA_KEY)).toBe('1')
  })

  it('does not ask for a restore when every workout was deleted on purpose', async () => {
    stubLocalStorage({ [HAD_DATA_KEY]: '1' })
    const workout = await startWorkout()
    await finishWorkout(workout.id)
    await deleteWorkout(workout.id)

    expect(await bootstrap()).toEqual({ needsRestore: false })
  })
})
