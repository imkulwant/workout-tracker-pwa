import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listExercises } from '../data/repositories/exercises'
import * as seed from '../data/seed'
import { resetDb } from '../test/db'
import { bootstrap } from './bootstrap'

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
