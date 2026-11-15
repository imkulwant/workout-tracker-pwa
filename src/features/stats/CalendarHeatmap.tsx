import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  calendarLevels,
  calendarValues,
  calendarWeeks,
  type CalendarMetric,
} from '../../domain/heatmaps'
import {
  formatDay,
  formatDayWithYear,
  formatDurationShort,
  formatVolumeKg,
} from '../../domain/format'
import {
  countMetricSets,
  totalVolumeKg,
  workoutDurationMs,
} from '../../domain/metrics'
import { BODY_PARTS, BODY_PART_LABELS } from '../../domain/muscles'
import type { BodyPart, LocalDate } from '../../domain/types'
import { Chip } from '../../ui/Chip'
import { Sheet } from '../../ui/Sheet'
import { HeatLegend, heatColor, levelWord } from './heat'
import type { StatsData } from './useStatsData'

const METRICS: { id: CalendarMetric; label: string }[] = [
  { id: 'sets', label: 'Sets' },
  { id: 'volume', label: 'Volume' },
  { id: 'duration', label: 'Duration' },
]

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
const CELL = 14
const GAP = 3

function describe(metric: CalendarMetric, value: number): string {
  if (value <= 0) return 'no training'
  if (metric === 'sets') return `${value} ${value === 1 ? 'set' : 'sets'}`
  if (metric === 'volume') return `${formatVolumeKg(value)} kg`
  return formatDurationShort(value)
}

/** One cell per day for the last 53 weeks, shaded by how much you did. */
export function CalendarHeatmap({ data }: { data: StatsData }) {
  const [metric, setMetric] = useState<CalendarMetric>('sets')
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null)
  const [day, setDay] = useState<LocalDate | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const weeks = useMemo(() => calendarWeeks(data.today), [data.today])
  const { values, levels } = useMemo(() => {
    const values = calendarValues({
      sets: data.sets,
      workouts: data.workoutsById,
      exercises: data.exercises,
      metric,
      bodyPart,
    })
    return {
      values,
      levels: calendarLevels(values, weeks[0]!.weekStart, data.today),
    }
  }, [data, metric, bodyPart, weeks])

  // Opens on the current week, which is at the right-hand end.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const dayWorkouts = day ? data.workouts.filter((w) => w.date === day) : []

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-3">
      <h2 id="calendar-heading" className="text-sm text-muted">
        Training calendar
      </h2>
      <div role="group" aria-label="Metric" className="flex flex-wrap gap-2">
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
        aria-label="Body part"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        <Chip selected={bodyPart === null} onClick={() => setBodyPart(null)}>
          All
        </Chip>
        {BODY_PARTS.map((part) => (
          <Chip
            key={part}
            selected={bodyPart === part}
            onClick={() => setBodyPart(part)}
          >
            {BODY_PART_LABELS[part]}
          </Chip>
        ))}
      </div>

      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="flex shrink-0 flex-col pt-4 text-[10px] text-muted"
          style={{ gap: GAP }}
        >
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((label, i) => (
            <span key={i} style={{ height: CELL, lineHeight: `${CELL}px` }}>
              {label}
            </span>
          ))}
        </div>
        <div
          ref={scroller}
          data-testid="calendar-scroll"
          className="min-w-0 flex-1 overflow-x-auto pb-2"
        >
          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, index) => {
              const previous = weeks[index - 1]
              const first = week.days.find((d) => d !== null)!
              const month = Number(first.slice(5, 7))
              const showMonth =
                index === 0 || Number(previous!.weekStart.slice(5, 7)) !== month
              return (
                <div
                  key={week.weekStart}
                  className="flex flex-col"
                  style={{ gap: GAP }}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 whitespace-nowrap text-[10px] text-muted"
                  >
                    {showMonth ? MONTHS[month - 1] : ''}
                  </span>
                  {week.days.map((date, d) =>
                    date === null ? (
                      <span key={d} style={{ width: CELL, height: CELL }} />
                    ) : (
                      <button
                        key={date}
                        type="button"
                        data-date={date}
                        data-level={levels.get(date) ?? 0}
                        aria-label={`${formatDay(date)}: ${describe(metric, values.get(date) ?? 0)}`}
                        onClick={() => setDay(date)}
                        className="rounded-[3px] border border-border"
                        style={{
                          width: CELL,
                          height: CELL,
                          background: heatColor(levels.get(date) ?? 0),
                        }}
                      />
                    ),
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <HeatLegend />

      <Sheet
        open={day !== null}
        onClose={() => setDay(null)}
        title={day ? formatDayWithYear(day) : 'Day'}
      >
        {dayWorkouts.length === 0 ? (
          <p className="text-muted">No workouts on this day.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayWorkouts.map((workout) => {
              const sets = data.sets.filter((s) => s.workoutId === workout.id)
              return (
                <li key={workout.id}>
                  <Link
                    to={`/history/${workout.id}`}
                    className="tap-target flex flex-col rounded-control bg-surface-2 p-3 active:bg-border"
                  >
                    <span className="font-semibold">
                      {workout.title || 'Workout'}
                    </span>
                    <span className="text-sm text-muted">
                      {formatDurationShort(workoutDurationMs(workout))} ·{' '}
                      {countMetricSets(sets)} sets ·{' '}
                      {formatVolumeKg(totalVolumeKg(sets))} kg
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {day && levels.get(day) !== undefined && (
          <p className="mt-3 text-sm text-muted">
            {describe(metric, values.get(day) ?? 0)} (
            {levelWord(levels.get(day)!)} for this view).
          </p>
        )}
      </Sheet>
    </section>
  )
}
