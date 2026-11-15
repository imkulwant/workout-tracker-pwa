import { formatDurationShort, formatVolumeKg } from '../../domain/format'
import {
  countMetricSets,
  muscleSetCounts,
  totalVolumeKg,
  workoutDurationMs,
} from '../../domain/metrics'
import { MUSCLE_LABELS } from '../../domain/muscles'
import type { Exercise, Workout, WorkoutSet } from '../../domain/types'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-card bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}

/** Duration, sets, volume and the muscles worked, for a finished workout. */
export function WorkoutTotals({
  workout,
  sets,
  exercises,
}: {
  workout: Workout
  sets: readonly WorkoutSet[]
  exercises: readonly Exercise[]
}) {
  const muscles = muscleSetCounts(
    sets,
    new Map(exercises.map((exercise) => [exercise.id, exercise])),
  )
  return (
    <>
      <dl className="grid grid-cols-3 gap-2">
        <Tile
          label="Duration"
          value={formatDurationShort(workoutDurationMs(workout))}
        />
        <Tile label="Sets" value={String(countMetricSets(sets))} />
        <Tile
          label="Volume"
          value={`${formatVolumeKg(totalVolumeKg(sets))} kg`}
        />
      </dl>

      <section
        aria-labelledby="muscles-heading"
        className="flex flex-col gap-2 rounded-card bg-surface p-4"
      >
        <h2 id="muscles-heading" className="text-sm text-muted">
          Muscles worked
        </h2>
        {muscles.length === 0 ? (
          <p className="text-muted">No sets counted.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {muscles.map(([muscle, count]) => (
              <li key={muscle} className="flex justify-between">
                <span>{MUSCLE_LABELS[muscle]}</span>
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
