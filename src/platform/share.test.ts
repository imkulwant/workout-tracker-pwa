import { describe, expect, it, vi } from 'vitest'
import { createSaveFile, type ShareEnv } from './share'

const file = new File(['{}'], 'workout-tracker-2026-11-15.json', {
  type: 'application/json',
})

function downloadEnv() {
  const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  const env: ShareEnv = {
    document: { createElement: () => link, body: { append: vi.fn() } },
    URL: {
      createObjectURL: vi.fn(() => 'blob:abc'),
      revokeObjectURL: vi.fn(),
    },
  }
  return { env, link }
}

describe('saveFile', () => {
  it('opens the share sheet when the browser can share files', async () => {
    const share = vi.fn(async () => {})
    const save = createSaveFile({ navigator: { canShare: () => true, share } })

    expect(await save(file)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ files: [file], title: file.name })
  })

  it('reports a closed share sheet as cancelled, without downloading', async () => {
    const { env, link } = downloadEnv()
    const save = createSaveFile({
      ...env,
      navigator: {
        canShare: () => true,
        share: async () => {
          throw Object.assign(new Error('x'), { name: 'AbortError' })
        },
      },
    })

    expect(await save(file)).toBe('cancelled')
    expect(link.click).not.toHaveBeenCalled()
  })

  it('reports a missing tap as blocked, so the caller can ask for another', async () => {
    const save = createSaveFile({
      navigator: {
        canShare: () => true,
        share: async () => {
          throw Object.assign(new Error('x'), { name: 'NotAllowedError' })
        },
      },
    })
    expect(await save(file)).toBe('blocked')
  })

  it('downloads when sharing files is not supported', async () => {
    const { env, link } = downloadEnv()
    const save = createSaveFile({
      ...env,
      navigator: { canShare: () => false },
    })

    expect(await save(file)).toBe('downloaded')
    expect(link.download).toBe(file.name)
    expect(link.href).toBe('blob:abc')
    expect(link.click).toHaveBeenCalledOnce()
    expect(env.URL!.revokeObjectURL).toHaveBeenCalledWith('blob:abc')
  })

  it('downloads when sharing fails in some other way', async () => {
    const { env, link } = downloadEnv()
    const save = createSaveFile({
      ...env,
      navigator: {
        canShare: () => true,
        share: async () => {
          throw new Error('odd')
        },
      },
    })
    expect(await save(file)).toBe('downloaded')
    expect(link.click).toHaveBeenCalledOnce()
  })

  it('is blocked when there is nothing to share or download with', async () => {
    expect(await createSaveFile({})(file)).toBe('blocked')
  })
})
