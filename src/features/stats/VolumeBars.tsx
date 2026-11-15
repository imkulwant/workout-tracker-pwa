import { useMemo } from 'react'
import { formatVolumeKg } from '../../domain/format'
import { weeklyVolume } from '../../domain/heatmaps'
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

const WIDTH = 320
const HEIGHT = 140
const TOP = 14
const BOTTOM = 20

/** Volume per calendar week for the last 12 weeks, as bars with a text table behind them. */
export function VolumeBars({ data }: { data: StatsData }) {
  const weeks = useMemo(() => weeklyVolume(data.sets, data.today), [data])
  const max = Math.max(...weeks.map((w) => w.volumeKg), 1)
  const slot = WIDTH / weeks.length
  const plot = HEIGHT - TOP - BOTTOM

  return (
    <section aria-labelledby="volume-heading" className="flex flex-col gap-2">
      <h2 id="volume-heading" className="text-sm text-muted">
        Weekly volume
      </h2>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Weekly volume for the last 12 weeks. The highest week was ${formatVolumeKg(max)} kilograms.`}
        className="w-full"
      >
        {weeks.map((week, i) => {
          const height = (week.volumeKg / max) * plot
          const x = i * slot + slot * 0.15
          return (
            <g key={week.weekStart} data-week={week.weekStart}>
              <rect
                x={x}
                y={TOP + plot - height}
                width={slot * 0.7}
                height={Math.max(height, week.volumeKg > 0 ? 1 : 0)}
                rx={2}
                fill="var(--color-heat-3)"
              />
              {i % 2 === 0 && (
                <text
                  x={x + slot * 0.35}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--color-muted)"
                >
                  {shortDate(week.weekStart)}
                </text>
              )}
            </g>
          )
        })}
        <text x="0" y="9" fontSize="8" fill="var(--color-muted)">
          {formatVolumeKg(max)} kg
        </text>
      </svg>
      <table className="sr-only">
        <caption>Volume per week, in kilograms</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{shortDate(week.weekStart)}</th>
              <td>{formatVolumeKg(week.volumeKg)} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
