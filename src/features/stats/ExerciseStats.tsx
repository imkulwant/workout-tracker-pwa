import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { listCountableSets } from '../../data/repositories/sets'
import { toLocalDate } from '../../domain/dates'
import { formatDayWithYear, formatWeightKg } from '../../domain/format'
import {
  progressSeries,
  type ProgressMetric,
  type ProgressRange,
} from '../../domain/progress'
import {
  RECORD_LABELS,
  personalBests,
  recordKindsFor,
} from '../../domain/records'
import type { Exercise } from '../../domain/types'
import { Chip } from '../../ui/Chip'
import { formatRecordValue } from './recordText'

const METRICS: { id: ProgressMetric; label: string }[] = [
  { id: 'e1rm', label: 'Est. 1RM' },
  { id: 'weight', label: 'Heaviest' },
  { id: 'volume', label: 'Volume' },
]
const RANGES: { id: ProgressRange; label: string }[] = [
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
  { id: '1y', label: '1 year' },
  { id: 'all', label: 'All time' },
]

const WIDTH = 320
const HEIGHT = 150
const PAD = { left: 38, right: 10, top: 12, bottom: 22 }

function Chart({ points }: { points: { date: string; value: number }[] }) {
  const values = points.map((p) => p.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  const first = points[0]!.date
  const last = points.at(-1)!.date
  const days = (date: string) => Date.parse(date) / 86_400_000
  const timeSpan = days(last) - days(first) || 1
  const x = (date: string) =>
    points.length === 1
      ? WIDTH / 2
      : PAD.left +
        ((days(date) - days(first)) / timeSpan) * (WIDTH - PAD.left - PAD.right)
  const y = (value: number) =>
    HEIGHT -
    PAD.bottom -
    ((value - low) / span) * (HEIGHT - PAD.top - PAD.bottom)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Progress over ${points.length} ${points.length === 1 ? 'session' : 'sessions'}, from ${formatWeightKg(values[0]!)} to ${formatWeightKg(values.at(-1)!)}.`}
      className="w-full"
    >
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={HEIGHT - PAD.bottom}
        y2={HEIGHT - PAD.bottom}
        stroke="var(--color-border)"
      />
      <text x="0" y={y(high) + 3} fontSize="8" fill="var(--color-muted)">
        {formatWeightKg(Math.round(high * 10) / 10)}
      </text>
      {high !== low && (
        <text x="0" y={y(low) + 3} fontSize="8" fill="var(--color-muted)">
          {formatWeightKg(Math.round(low * 10) / 10)}
        </text>
      )}
      <text x={PAD.left} y={HEIGHT - 6} fontSize="8" fill="var(--color-muted)">
        {formatDayWithYear(first)}
      </text>
      {points.length > 1 && (
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 6}
          fontSize="8"
          textAnchor="end"
          fill="var(--color-muted)"
        >
          {formatDayWithYear(last)}
        </text>
      )}
      <polyline
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
      />
      {points.map((p) => (
        <circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.value)}
          r={2.5}
          fill="var(--color-accent)"
        />
      ))}
    </svg>
  )
}

/** Personal records and a progress chart for one exercise. */
export function ExerciseStats({ exercise }: { exercise: Exercise }) {
  const [metric, setMetric] = useState<ProgressMetric>('e1rm')
  const [range, setRange] = useState<ProgressRange>('6m')
  const sets = useLiveQuery(
    () => listCountableSets({ exerciseId: exercise.id }),
    [exercise.id],
  )
  const [today] = useState(() => toLocalDate(Date.now()))
  const bests = useMemo(
    () => (sets ? personalBests(sets, exercise.loadType) : {}),
    [sets, exercise.loadType],
  )
  const points = useMemo(
    () => (sets ? progressSeries(sets, metric, range, today) : []),
    [sets, metric, range, today],
  )
  if (!sets) return null

  return (
    <>
      <section
        aria-labelledby="bests-heading"
        className="flex flex-col gap-2 rounded-card bg-surface p-4"
      >
        <h2 id="bests-heading" className="text-sm text-muted">
          Personal records
        </h2>
        {Object.keys(bests).length === 0 ? (
          <p className="text-muted">No completed sets yet.</p>
        ) : (
          <dl className="flex flex-col gap-1">
            {recordKindsFor(exercise.loadType).flatMap((kind) => {
              const best = bests[kind]
              return best
                ? [
                    <div key={kind} className="flex justify-between gap-2">
                      <dt>{RECORD_LABELS[kind]}</dt>
                      <dd className="tabular-nums">
                        {formatRecordValue(kind, best.value)}{' '}
                        <span className="text-sm text-muted">
                          {formatDayWithYear(best.date)}
                        </span>
                      </dd>
                    </div>,
                  ]
                : []
            })}
          </dl>
        )}
      </section>

      <section
        aria-labelledby="progress-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="progress-heading" className="text-sm text-muted">
          Progress
        </h2>
        <div role="group" aria-label="Measure" className="flex gap-2">
          {METRICS.map((m) => (
            <Chip
              key={m.id}
              selected={metric === m.id}
              onClick={() => setMetric(m.id)}
            >
              {m.label}
            </Chip>
          ))}
        </div>
        <div
          role="group"
          aria-label="Time range"
          className="-mx-4 flex gap-2 overflow-x-auto px-4"
        >
          {RANGES.map((r) => (
            <Chip
              key={r.id}
              selected={range === r.id}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </Chip>
          ))}
        </div>
        {points.length === 0 ? (
          <p className="text-muted">
            Nothing to show for this measure and range.
          </p>
        ) : (
          <>
            <Chart points={points} />
            <table className="sr-only">
              <caption>Progress by session</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Value (kg)</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.date}>
                    <th scope="row">{formatDayWithYear(p.date)}</th>
                    <td>{formatWeightKg(Math.round(p.value * 10) / 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  )
}
