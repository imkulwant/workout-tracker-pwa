import { useLiveQuery } from 'dexie-react-hooks'
import { getExercise } from '../../data/repositories/exercises'
import { getPreviousPerformance, listSets } from '../../data/repositories/sets'
import { MUSCLE_LABELS } from '../../domain/muscles'
import { setLabels } from '../../domain/setLabel'
import type { WorkoutExercise, WorkoutSet } from '../../domain/types'
import { Button } from '../../ui/Button'
import { addSetToExercise } from './actions'
import { SET_GRID, SetRow } from './SetRow'

export interface ExerciseCardProps {
  row: WorkoutExercise
  /** Called after a set of this exercise is ticked. */
  onSetCompleted?: (set: WorkoutSet) => void
}

/** One exercise of the active workout: its name, muscles and set rows. */
export function ExerciseCard({ row, onSetCompleted }: ExerciseCardProps) {
  const exercise = useLiveQuery(
    () => getExercise(row.exerciseId),
    [row.exerciseId],
  )
  const sets = useLiveQuery(() => listSets(row.id), [row.id])
  const previous = useLiveQuery(
    () => getPreviousPerformance(row.exerciseId, row.workoutId),
    [row.exerciseId, row.workoutId],
  )

  if (!exercise || !sets) return null
  const labels = setLabels(sets)

  return (
    <section
      aria-label={exercise.name}
      className="flex flex-col gap-2 rounded-card bg-surface p-3"
    >
      <header className="px-1">
        <h2 className="text-lg font-semibold">{exercise.name}</h2>
        <p className="text-sm text-muted">
          {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
        </p>
        {row.notes && <p className="mt-1 text-sm">{row.notes}</p>}
      </header>

      <div aria-hidden="true" className={`${SET_GRID} px-1 text-xs text-muted`}>
        <span>Set</span>
        <span>Previous</span>
        <span className="text-center">
          {exercise.loadType === 'bodyweight_reps' ? '+kg' : 'kg'}
        </span>
        <span className="text-center">Reps</span>
        <span />
      </div>

      <ul className="flex flex-col gap-1">
        {sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            index={index}
            label={labels[index]!}
            loadType={exercise.loadType}
            previous={previous?.[index]}
            onCompleted={onSetCompleted}
          />
        ))}
      </ul>

      <Button variant="secondary" onClick={() => void addSetToExercise(row.id)}>
        Add set
      </Button>
    </section>
  )
}
