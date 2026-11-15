import { describe, expect, it, vi } from 'vitest'
import {
  STORAGE_FAILURE_EVENT,
  isStorageFailure,
  reportStorageFailure,
  watchStorageFailures,
} from './storageFailure'

const named = (name: string, inner?: unknown) =>
  Object.assign(new Error(name), { name, inner })

describe('isStorageFailure', () => {
  it.each([
    'QuotaExceededError',
    'AbortError',
    'TransactionInactiveError',
    'DatabaseClosedError',
    'UnknownError',
  ])('recognises %s', (name) => {
    expect(isStorageFailure(named(name))).toBe(true)
  })

  it('looks through a wrapping error', () => {
    expect(
      isStorageFailure(named('DexieError', named('QuotaExceededError'))),
    ).toBe(true)
  })

  it('ignores other errors and non-errors', () => {
    expect(isStorageFailure(new Error('nope'))).toBe(false)
    expect(isStorageFailure(named('InvariantError'))).toBe(false)
    expect(isStorageFailure(undefined)).toBe(false)
    expect(isStorageFailure('QuotaExceededError')).toBe(false)
    expect(isStorageFailure(null)).toBe(false)
  })

  it('does not loop on an error that wraps itself', () => {
    const loop: { name: string; inner?: unknown } = { name: 'X' }
    loop.inner = loop
    expect(isStorageFailure(loop)).toBe(false)
  })
})

describe('reportStorageFailure and watchStorageFailures', () => {
  it('tells a watcher about a reported storage failure only', () => {
    const target = new EventTarget()
    const onFailure = vi.fn()
    watchStorageFailures(onFailure, target)

    expect(reportStorageFailure(new Error('other'), target)).toBe(false)
    expect(onFailure).not.toHaveBeenCalled()

    expect(reportStorageFailure(named('QuotaExceededError'), target)).toBe(true)
    expect(onFailure).toHaveBeenCalledOnce()
  })

  it('also hears unhandled rejections and errors, when they are storage failures', () => {
    const target = new EventTarget()
    const onFailure = vi.fn()
    watchStorageFailures(onFailure, target)

    const rejection = (reason: unknown) =>
      Object.assign(new Event('unhandledrejection'), { reason })
    target.dispatchEvent(rejection(new Error('other')))
    expect(onFailure).not.toHaveBeenCalled()
    target.dispatchEvent(rejection(named('QuotaExceededError')))
    expect(onFailure).toHaveBeenCalledTimes(1)

    target.dispatchEvent(
      Object.assign(new Event('error'), { error: named('AbortError') }),
    )
    expect(onFailure).toHaveBeenCalledTimes(2)
  })

  it('stops listening when told to', () => {
    const target = new EventTarget()
    const onFailure = vi.fn()
    const stop = watchStorageFailures(onFailure, target)
    stop()
    target.dispatchEvent(new Event(STORAGE_FAILURE_EVENT))
    expect(onFailure).not.toHaveBeenCalled()
  })
})
