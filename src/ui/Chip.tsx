import type { ReactNode } from 'react'

export interface ChipProps {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
}

/** A pill-shaped toggle, used for filters and ranges. */
export function Chip({ selected = false, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`tap-target rounded-full border px-4 text-sm font-medium transition-colors ${
        selected
          ? 'border-accent bg-accent text-on-accent'
          : 'border-border bg-surface text-text active:bg-surface-2'
      }`}
    >
      {children}
    </button>
  )
}
