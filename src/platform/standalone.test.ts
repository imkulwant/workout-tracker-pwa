import { describe, expect, it, vi } from 'vitest'
import { isStandalone } from './standalone'

const media = (matches: boolean) => vi.fn(() => ({ matches }))

describe('isStandalone', () => {
  it('is true when the display mode is standalone', () => {
    const matchMedia = media(true)

    expect(isStandalone({ matchMedia })).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)')
  })

  it('is true when iOS reports navigator.standalone', () => {
    expect(
      isStandalone({
        matchMedia: media(false),
        navigator: { standalone: true },
      }),
    ).toBe(true)
  })

  it('is false in a normal browser tab', () => {
    expect(
      isStandalone({
        matchMedia: media(false),
        navigator: { standalone: false },
      }),
    ).toBe(false)
    expect(isStandalone({ matchMedia: media(false), navigator: {} })).toBe(
      false,
    )
  })

  it('is false when the environment offers neither signal', () => {
    expect(isStandalone({})).toBe(false)
  })

  it('is false in plain Node, where there is no window', () => {
    expect(isStandalone()).toBe(false)
  })
})
