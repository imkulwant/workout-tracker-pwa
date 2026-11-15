import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { listExercises } from '../../data/repositories/exercises'
import { listSetsByWorkout } from '../../data/repositories/sets'
import {
  countCompletedWorkouts,
  listCompletedWorkouts,
} from '../../data/repositories/workouts'
import {
  formatDay,
  formatDurationShort,
  formatVolumeKg,
} from '../../domain/format'
import {
  groupByWeek,
  summariseWorkout,
  type HistoryEntry,
} from '../../domain/history'
import { workoutDurationMs } from '../../domain/metrics'
import { BODY_PART_LABELS } from '../../domain/muscles'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Screen } from '../../ui/Screen'

/** Workouts shown at first, and added by each "Show more". */
const PAGE_SIZE = 30

function EntryRow({ entry }: { entry: HistoryEntry }) {
  const { workout } = entry
  return (
    <li>
      <Link
        to={`/history/${workout.id}`}
        className="tap-target flex flex-col gap-1 rounded-card bg-surface p-3 active:bg-surface-2"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate font-semibold">
            {workout.title || 'Workout'}
          </span>
          <span className="shrink-0 text-sm text-muted">
            {formatDay(workout.date)}
          </span>
        </span>
        <span className="text-sm text-muted">
          {formatDurationShort(workoutDurationMs(workout))} · {entry.setCount}{' '}
          {entry.setCount === 1 ? 'set' : 'sets'} ·{' '}
          {formatVolumeKg(entry.volumeKg)} kg
        </span>
        {entry.bodyParts.length > 0 && (
          <span className="text-sm">
            {entry.bodyParts.map((part) => BODY_PART_LABELS[part]).join(', ')}
          </span>
        )}
      </Link>
    </li>
  )
}

/** `/history`: finished workouts, newest first, grouped by week. */
export function HistoryScreen() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const data = useLiveQuery(async () => {
    const [workouts, total, exercises] = await Promise.all([
      listCompletedWorkouts(limit),
      countCompletedWorkouts(),
      listExercises({ includeArchived: true }),
    ])
    const sets = await listSetsByWorkout(workouts.map((w) => w.id))
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const entries = workouts.map((workout) =>
      summariseWorkout(workout, sets.get(workout.id) ?? [], byId),
    )
    return { entries, total }
  }, [limit])

  if (data === undefined) return null
  const { entries, total } = data

  if (total === 0) {
    return (
      <Screen title="History">
        <EmptyState
          title="No workouts yet"
          description="Finished workouts show up here."
        />
      </Screen>
    )
  }

  return (
    <Screen title="History">
      {groupByWeek(entries).map((week) => (
        <section
          key={week.weekStart}
          aria-label={`Week of ${formatDay(week.weekStart)}`}
          className="flex flex-col gap-2"
        >
          <h2 className="text-sm text-muted">
            Week of {formatDay(week.weekStart)}
          </h2>
          <ul className="flex flex-col gap-2">
            {week.entries.map((entry) => (
              <EntryRow key={entry.workout.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
      {entries.length < total && (
        <Button variant="secondary" onClick={() => setLimit(limit + PAGE_SIZE)}>
          Show more
        </Button>
      )}
    </Screen>
  )
}
