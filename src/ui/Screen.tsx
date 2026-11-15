import type { ReactNode } from 'react'
import { BackButton } from './BackButton'

export interface ScreenProps {
  title: string
  /** Set on pushed screens: where Back goes when there is no history. */
  back?: string
  children?: ReactNode
}

/**
 * The frame of a screen: a sticky header and the content below it. The header
 * carries the top safe-area inset, so scrolled content never slides under the
 * iOS status bar.
 */
export function Screen({ title, back, children }: ScreenProps) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-safe sticky top-0 z-10 -mx-4 bg-bg px-4">
        <div className="flex items-center gap-2 pt-3 pb-2">
          {back && <BackButton fallback={back} />}
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  )
}
