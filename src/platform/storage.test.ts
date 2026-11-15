import { describe, expect, it, vi } from 'vitest'
import {
  getPersistenceState,
  getStorageEstimate,
  requestPersistence,
} from './storage'

describe('requestPersistence', () => {
  it('reports granted without asking again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true)

    const state = await requestPersistence({
      persisted: async () => true,
      persist,
    })

    expect(state).toBe('granted')
    expect(persist).not.toHaveBeenCalled()
  })

  it('asks, and reports granted when the browser agrees', async () => {
    expect(
      await requestPersistence({
        persisted: async () => false,
        persist: async () => true,
      }),
    ).toBe('granted')
  })

  it('reports denied when the browser refuses', async () => {
    expect(
      await requestPersistence({
        persisted: async () => false,
        persist: async () => false,
      }),
    ).toBe('denied')
  })

  it('still asks when the browser has no persisted() check', async () => {
    expect(await requestPersistence({ persist: async () => true })).toBe(
      'granted',
    )
  })

  it('reports unsupported when persist() does not exist or there is no storage', async () => {
    expect(await requestPersistence({})).toBe('unsupported')
    expect(await requestPersistence(undefined)).toBe('unsupported')
  })

  it('never throws: a failing browser call becomes denied', async () => {
    const failing = async () => {
      throw new Error('boom')
    }

    expect(await requestPersistence({ persist: failing })).toBe('denied')
    expect(
      await requestPersistence({ persisted: failing, persist: failing }),
    ).toBe('denied')
  })
})

describe('getPersistenceState', () => {
  it('reads the current state without asking', async () => {
    const persist = vi.fn(async () => true)

    expect(
      await getPersistenceState({ persisted: async () => true, persist }),
    ).toBe('granted')
    expect(
      await getPersistenceState({ persisted: async () => false, persist }),
    ).toBe('denied')
    expect(persist).not.toHaveBeenCalled()
  })

  it('reports unsupported without a persisted() check, and denied if it throws', async () => {
    expect(await getPersistenceState({ persist: async () => true })).toBe(
      'unsupported',
    )
    expect(await getPersistenceState(undefined)).toBe('unsupported')
    expect(
      await getPersistenceState({
        persisted: async () => {
          throw new Error('boom')
        },
      }),
    ).toBe('denied')
  })
})

describe('getStorageEstimate', () => {
  it('returns usage and quota in bytes', async () => {
    expect(
      await getStorageEstimate({
        estimate: async () => ({ usage: 1024, quota: 1_000_000 }),
      }),
    ).toEqual({ usageBytes: 1024, quotaBytes: 1_000_000 })
  })

  it('is null when the browser cannot estimate, gives partial numbers, or fails', async () => {
    expect(await getStorageEstimate(undefined)).toBeNull()
    expect(await getStorageEstimate({})).toBeNull()
    expect(
      await getStorageEstimate({ estimate: async () => ({ usage: 5 }) }),
    ).toBeNull()
    expect(
      await getStorageEstimate({
        estimate: async () => {
          throw new Error('no')
        },
      }),
    ).toBeNull()
  })
})
