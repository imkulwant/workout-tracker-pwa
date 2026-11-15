// Hands a file to the user. On iPhone that is the share sheet, which has Save
// to Files. Elsewhere the browser downloads it. The share sheet only opens
// from a tap, so a call that comes too long after the tap reports `blocked`,
// and the caller asks for another tap.

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'blocked'

export interface ShareEnv {
  navigator?: {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string }) => Promise<void>
  }
  document?: {
    createElement(tag: 'a'): {
      href: string
      download: string
      click(): void
      remove(): void
    }
    body: { append(node: unknown): void }
  }
  URL?: {
    createObjectURL(blob: Blob): string
    revokeObjectURL(url: string): void
  }
}

const errorName = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : ''

export function createSaveFile(env: ShareEnv) {
  return async function saveFile(file: File): Promise<SaveResult> {
    const nav = env.navigator
    if (nav?.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: file.name })
        return 'shared'
      } catch (error) {
        // Closing the sheet is not a failure, and a missing tap can be retried.
        if (errorName(error) === 'AbortError') return 'cancelled'
        if (errorName(error) === 'NotAllowedError') return 'blocked'
        // Anything else: fall through to a plain download.
      }
    }
    if (!env.document || !env.URL) return 'blocked'
    const url = env.URL.createObjectURL(file)
    const link = env.document.createElement('a')
    link.href = url
    link.download = file.name
    env.document.body.append(link)
    link.click()
    link.remove()
    env.URL.revokeObjectURL(url)
    return 'downloaded'
  }
}

export const saveFile = createSaveFile(globalThis as unknown as ShareEnv)
