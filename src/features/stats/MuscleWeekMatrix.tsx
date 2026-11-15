import { Fragment, useMemo, useState } from 'react'
import { bodyMapLevel, muscleWeekMatrix } from '../../domain/heatmaps'
import { BODY_PART_LABELS, MUSCLE_LABELS } from '../../domain/muscles'
import type { BodyPart } from '../../domain/types'
import { HeatLegend, heatColor, levelWord } from './heat'
import type { StatsData } from './useStatsData'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const shortDate = (date: string) =>
  `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`
const setsText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Cell({ value, label }: { value: number; label: string }) {
  const level = bodyMapLevel(value)
  return (
    <td
      data-level={level}
      aria-label={`${label}: ${setsText(value)} ${value === 1 ? 'set' : 'sets'}, ${levelWord(level)}`}
      className="h-7 min-w-7 border border-bg text-center text-[10px] tabular-nums"
      style={{
        background: heatColor(level),
        color: level >= 3 ? 'var(--color-bg)' : 'var(--color-text)',
      }}
    >
      {value > 0 ? setsText(value) : ''}
    </td>
  )
}

/** Sets per week for each body part, and under it each muscle, over 12 weeks. */
export function MuscleWeekMatrix({ data }: { data: StatsData }) {
  const [open, setOpen] = useState<ReadonlySet<BodyPart>>(new Set())
  const matrix = useMemo(
    () => muscleWeekMatrix(data.sets, data.exercises, data.today),
    [data],
  )
  const toggle = (part: BodyPart) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(part)) next.delete(part)
      else next.add(part)
      return next
    })

  return (
    <section aria-labelledby="matrix-heading" className="flex flex-col gap-3">
      <h2 id="matrix-heading" className="text-sm text-muted">
        Muscles by week
      </h2>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="border-collapse text-sm">
          <caption className="sr-only">
            Sets per week for each body part over the last 12 weeks
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 bg-bg pr-2 text-left text-xs font-normal text-muted"
              >
                Week of
              </th>
              {matrix.weekStarts.map((week) => (
                <th
                  key={week}
                  scope="col"
                  className="min-w-7 px-0.5 text-[10px] font-normal text-muted"
                >
                  {shortDate(week)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <Fragment key={row.part}>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-bg pr-2 text-left font-normal"
                  >
                    <button
                      type="button"
                      aria-expanded={open.has(row.part)}
                      onClick={() => toggle(row.part)}
                      className="tap-target flex items-center gap-1 whitespace-nowrap text-left"
                    >
                      <span aria-hidden="true" className="w-3 text-muted">
                        {open.has(row.part) ? '▾' : '▸'}
                      </span>
                      {BODY_PART_LABELS[row.part]}
                    </button>
                  </th>
                  {row.cells.map((value, i) => (
                    <Cell
                      key={matrix.weekStarts[i]}
                      value={value}
                      label={`${BODY_PART_LABELS[row.part]}, week of ${shortDate(matrix.weekStarts[i]!)}`}
                    />
                  ))}
                </tr>
                {open.has(row.part) &&
                  row.muscles.map((muscle) => (
                    <tr key={muscle.muscle}>
                      <th
                        scope="row"
                        className="sticky left-0 bg-bg pr-2 pl-5 text-left text-xs font-normal text-muted"
                      >
                        {MUSCLE_LABELS[muscle.muscle]}
                      </th>
                      {muscle.cells.map((value, i) => (
                        <Cell
                          key={matrix.weekStarts[i]}
                          value={value}
                          label={`${MUSCLE_LABELS[muscle.muscle]}, week of ${shortDate(matrix.weekStarts[i]!)}`}
                        />
                      ))}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <HeatLegend label="sets a week" />
    </section>
  )
}
