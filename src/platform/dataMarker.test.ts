import { describe, expect, it } from 'vitest'
import {
  HAD_DATA_KEY,
  createDataMarker,
  type MarkerStorage,
} from './dataMarker'

function memoryStorage(): MarkerStorage & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

describe('dataMarker', () => {
  it('starts unset, can be set, and can be cleared', () => {
    const storage = memoryStorage()
    const marker = createDataMarker(storage)
    expect(marker.isSet()).toBe(false)

    marker.mark()
    expect(marker.isSet()).toBe(true)
    expect(storage.items.get(HAD_DATA_KEY)).toBe('1')

    marker.clear()
    expect(marker.isSet()).toBe(false)
  })

  it('never throws when storage is missing or refuses', () => {
    const missing = createDataMarker(undefined)
    expect(() => missing.mark()).not.toThrow()
    expect(missing.isSet()).toBe(false)
    expect(() => missing.clear()).not.toThrow()

    const refusing = createDataMarker({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => refusing.mark()).not.toThrow()
    expect(refusing.isSet()).toBe(false)
    expect(() => refusing.clear()).not.toThrow()
  })
})
