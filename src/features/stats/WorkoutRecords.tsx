import { useLiveQuery } from 'dexie-react-hooks'
import { getExercise } from '../../data/repositories/exercises'
import { listEarlierSets, listWorkoutSets } from '../../data/repositories/sets'
import {
  RECORD_LABELS,
  sessionRecords,
  type RecordBreak,
} from '../../domain/records'
import type { Id, Workout } from '../../domain/types'
import { formatRecordValue } from './recordText'

interface ExerciseRecords {
  exerciseId: Id
  name: string
  breaks: RecordBreak[]
}

/**
 * The records a finished workout broke, against everything before it. It is
 * worked out when shown, so editing or deleting an earlier workout, or a set
 * in this one, changes it straight away. Shows nothing when there are none.
 */
export function WorkoutRecords({ workout }: { workout: Workout }) {
  const records = useLiveQuery(async (): Promise<ExerciseRecords[]> => {
    const sets = await listWorkoutSets(workout.id)
    const ids = [...new Set(sets.map((s) => s.exerciseId))]
    const found = await Promise.all(
      ids.map(async (exerciseId): Promise<ExerciseRecords | null> => {
        const exercise = await getExercise(exerciseId)
        if (!exercise) return null
        const breaks = sessionRecords(
          await listEarlierSets(exerciseId, workout),
          sets.filter((s) => s.exerciseId === exerciseId),
          exercise.loadType,
        )
        return breaks.length > 0
          ? { exerciseId, name: exercise.name, breaks }
          : null
      }),
    )
    return found.filter((r): r is ExerciseRecords => r !== null)
  }, [workout.id, workout.startedAt, workout.date])

  if (!records || records.length === 0) return null
  return (
    <section
      aria-labelledby={`records-heading-${workout.id}`}
      className="flex flex-col gap-2 rounded-card bg-surface p-4"
    >
      <h2 id={`records-heading-${workout.id}`} className="text-sm text-muted">
        Records
      </h2>
      <ul className="flex flex-col gap-3">
        {records.map((exercise) => (
          <li key={exercise.exerciseId} className="flex flex-col gap-1">
            <span className="font-semibold">{exercise.name}</span>
            <ul className="flex flex-col gap-0.5">
              {exercise.breaks.map((record) => (
                <li
                  key={record.kind}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span>{RECORD_LABELS[record.kind]}</span>
                  <span className="tabular-nums">
                    {formatRecordValue(record.kind, record.value)}{' '}
                    <span className="text-muted">
                      (was {formatRecordValue(record.kind, record.previous)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
