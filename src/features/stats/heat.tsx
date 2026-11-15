import type { Level } from '../../domain/heatmaps'

/** The fill of a heatmap cell for a level. */
export const heatColor = (level: Level): string => `var(--color-heat-${level})`

const LEVEL_WORDS: Record<Level, string> = {
  0: 'none',
  1: 'low',
  2: 'some',
  3: 'high',
  4: 'highest',
}
export const levelWord = (level: Level): string => LEVEL_WORDS[level]

/** The key to the colours: every level with its swatch and word, on every heatmap. */
export function HeatLegend({ label = 'Less to more' }: { label?: string }) {
  return (
    <ul
      aria-label={`Colour key, ${label}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
    >
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <li key={level} className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block size-3 rounded-sm border border-border"
            style={{ background: heatColor(level) }}
          />
          {levelWord(level)}
        </li>
      ))}
    </ul>
  )
}
