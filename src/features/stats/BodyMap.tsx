import { useMemo, useState } from 'react'
import {
  BODY_MAP_RANGES,
  bodyMapLevel,
  muscleDetails,
  muscleWeeklyRates,
} from '../../domain/heatmaps'
import { formatDayWithYear } from '../../domain/format'
import { MUSCLE_LABELS } from '../../domain/muscles'
import type { MuscleId } from '../../domain/types'
import { Chip } from '../../ui/Chip'
import { Sheet } from '../../ui/Sheet'
import {
  BACK,
  FRONT,
  MIRROR,
  SILHOUETTE,
  type FigureRegion,
} from './bodyFigures'
import { HeatLegend, heatColor, levelWord } from './heat'
import type { StatsData } from './useStatsData'

const rateText = (rate: number) => `${rate.toFixed(1)} sets a week`

function Figure({
  title,
  regions,
  rates,
  onSelect,
}: {
  title: string
  regions: readonly FigureRegion[]
  rates: ReadonlyMap<MuscleId, number>
  onSelect: (muscle: MuscleId) => void
}) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <svg
        viewBox="0 0 100 200"
        role="group"
        aria-label={title}
        className="w-full"
      >
        <g
          fill="var(--color-surface-2)"
          stroke="var(--color-border)"
          strokeWidth="0.6"
        >
          <circle {...SILHOUETTE.head} />
          {SILHOUETTE.halves.map((d) => (
            <g key={d}>
              <path d={d} />
              <path d={d} transform={MIRROR} />
            </g>
          ))}
        </g>
        {regions.map((region) => {
          const rate = rates.get(region.muscle) ?? 0
          const level = bodyMapLevel(rate)
          const label = `${MUSCLE_LABELS[region.muscle]}, ${rateText(rate)}`
          const shape = {
            d: region.d,
            fill: heatColor(level),
            stroke: 'var(--color-bg)',
            strokeWidth: 0.6,
            'data-muscle': region.muscle,
            'data-level': level,
          }
          return (
            <g key={region.muscle}>
              <path
                {...shape}
                role="button"
                tabIndex={0}
                aria-label={label}
                onClick={() => onSelect(region.muscle)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(region.muscle)
                  }
                }}
                className="cursor-pointer outline-none focus-visible:stroke-white"
              />
              {region.mirror && (
                // The right half does the same, but is left out of the tab
                // order and the accessibility tree so each muscle is read once.
                <path
                  {...shape}
                  transform={MIRROR}
                  aria-hidden="true"
                  onClick={() => onSelect(region.muscle)}
                  className="cursor-pointer"
                />
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="text-sm text-muted">{title}</figcaption>
    </figure>
  )
}

/** Front and back figures shaded by sets a week, with the same data as text. */
export function BodyMap({ data }: { data: StatsData }) {
  const [range, setRange] = useState<(typeof BODY_MAP_RANGES)[number]>(30)
  const [selected, setSelected] = useState<MuscleId | null>(null)

  const rates = useMemo(
    () => muscleWeeklyRates(data.sets, data.exercises, data.today, range),
    [data, range],
  )
  const ranked = useMemo(
    () =>
      [...rates].sort(
        (a, b) =>
          b[1] - a[1] || MUSCLE_LABELS[a[0]].localeCompare(MUSCLE_LABELS[b[0]]),
      ),
    [rates],
  )
  const details = selected
    ? muscleDetails(selected, data.sets, data.exercises, data.today, range)
    : null

  return (
    <section aria-labelledby="body-heading" className="flex flex-col gap-3">
      <h2 id="body-heading" className="text-sm text-muted">
        Body map
      </h2>
      <div role="group" aria-label="Range" className="flex gap-2">
        {BODY_MAP_RANGES.map((days) => (
          <Chip
            key={days}
            selected={range === days}
            onClick={() => setRange(days)}
          >
            {days} days
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Figure
          title="Front"
          regions={FRONT}
          rates={rates}
          onSelect={setSelected}
        />
        <Figure
          title="Back"
          regions={BACK}
          rates={rates}
          onSelect={setSelected}
        />
      </div>
      <HeatLegend label="sets a week" />

      <ol aria-label="Muscles, most worked first" className="flex flex-col">
        {ranked.map(([muscle, rate]) => (
          <li key={muscle}>
            <button
              type="button"
              onClick={() => setSelected(muscle)}
              className="tap-target flex w-full items-center justify-between gap-2 border-b border-border py-1 text-left"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 rounded-sm border border-border"
                  style={{ background: heatColor(bodyMapLevel(rate)) }}
                />
                {MUSCLE_LABELS[muscle]}
              </span>
              <span className="text-sm text-muted">
                {rate.toFixed(1)} · {levelWord(bodyMapLevel(rate))}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Sheet
        open={details !== null}
        onClose={() => setSelected(null)}
        title={selected ? MUSCLE_LABELS[selected] : 'Muscle'}
      >
        {details && (
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-sm text-muted">Last {range} days</dt>
              <dd className="text-xl font-bold">
                {rateText(details.weeklyRate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Last trained</dt>
              <dd>
                {details.lastTrained
                  ? formatDayWithYear(details.lastTrained)
                  : 'Not yet'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Top exercises</dt>
              <dd>
                {details.topExercises.length === 0 ? (
                  'None in this range'
                ) : (
                  <ol className="flex flex-col gap-1">
                    {details.topExercises.map((top) => (
                      <li key={top.exerciseId} className="flex justify-between">
                        <span>
                          {data.exercises.get(top.exerciseId)?.name ??
                            'Deleted exercise'}
                        </span>
                        <span className="tabular-nums text-muted">
                          {top.sets} sets
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </dd>
            </div>
          </dl>
        )}
      </Sheet>
    </section>
  )
}
