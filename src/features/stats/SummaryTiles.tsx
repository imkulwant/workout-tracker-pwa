import { startOfWeek } from '../../domain/dates'
import { formatVolumeKg } from '../../domain/format'
import {
  countMetricSets,
  totalVolumeKg,
  weeklyStreak,
} from '../../domain/metrics'
import type { StatsData } from './useStatsData'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-card bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}

/** This week at a glance: workouts, sets, volume, and the weekly streak. */
export function SummaryTiles({ data }: { data: StatsData }) {
  const weekStart = startOfWeek(data.today)
  const thisWeek = data.sets.filter((set) => set.date >= weekStart)
  const workouts = data.workouts.filter((w) => w.date >= weekStart)
  const streak = weeklyStreak(
    data.workouts.map((w) => w.date),
    data.today,
  )
  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-2">
      <h2 id="week-heading" className="text-sm text-muted">
        This week
      </h2>
      <dl className="grid grid-cols-2 gap-2">
        <Tile label="Workouts" value={String(workouts.length)} />
        <Tile label="Sets" value={String(countMetricSets(thisWeek))} />
        <Tile
          label="Volume"
          value={`${formatVolumeKg(totalVolumeKg(thisWeek))} kg`}
        />
        <Tile
          label="Streak"
          value={`${streak} ${streak === 1 ? 'week' : 'weeks'}`}
        />
      </dl>
    </section>
  )
}
