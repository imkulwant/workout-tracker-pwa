import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { getExercise } from '../../data/repositories/exercises'
import { getPreviousPerformance, listSets } from '../../data/repositories/sets'
import {
  removeWorkoutExercise,
  replaceWorkoutExercise,
  updateWorkoutExerciseNotes,
} from '../../data/repositories/workouts'
import { MUSCLE_LABELS } from '../../domain/muscles'
import { setLabels } from '../../domain/setLabel'
import type { WorkoutExercise, WorkoutSet } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Sheet } from '../../ui/Sheet'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { addSetToExercise } from './actions'
import { SET_GRID, SetRow } from './SetRow'

export interface ExerciseCardProps {
  row: WorkoutExercise
  /** Zero-based place among the workout's exercises. */
  index: number
  /** How many exercises the workout has. */
  count: number
  /** Moves this exercise one place up (-1) or down (1). */
  onMove: (direction: -1 | 1) => void
  /** Called after a set of this exercise is ticked. */
  onSetCompleted?: (set: WorkoutSet) => void
}

function NoteEditor({
  initial,
  onSave,
}: {
  initial: string
  onSave: (note: string) => void
}) {
  const [text, setText] = useState(initial)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(text.trim())
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        aria-label="Note"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
      />
      <Button type="submit">Save note</Button>
    </form>
  )
}

const MENU_BUTTON = 'w-full justify-start'

/** One exercise of the active workout: its name, muscles, sets and menu. */
export function ExerciseCard({
  row,
  index,
  count,
  onMove,
  onSetCompleted,
}: ExerciseCardProps) {
  const exercise = useLiveQuery(
    () => getExercise(row.exerciseId),
    [row.exerciseId],
  )
  const sets = useLiveQuery(() => listSets(row.id), [row.id])
  const previous = useLiveQuery(
    () => getPreviousPerformance(row.exerciseId, row.workoutId),
    [row.exerciseId, row.workoutId],
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  if (!exercise || !sets) return null
  const labels = setLabels(sets)

  return (
    <section
      aria-label={exercise.name}
      className="flex flex-col gap-2 rounded-card bg-surface p-3"
    >
      <header className="flex items-start gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{exercise.name}</h2>
          <p className="text-sm text-muted">
            {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
          </p>
          {row.notes && <p className="mt-1 text-sm">{row.notes}</p>}
        </div>
        <button
          type="button"
          aria-label={`${exercise.name} options`}
          onClick={() => setMenuOpen(true)}
          className="tap-target -mt-1 -mr-1 rounded-control px-3 text-xl font-bold text-muted active:bg-surface-2"
        >
          ⋯
        </button>
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
        {sets.map((set, setIndex) => (
          <SetRow
            key={set.id}
            set={set}
            index={setIndex}
            label={labels[setIndex]!}
            loadType={exercise.loadType}
            previous={previous?.[setIndex]}
            onCompleted={onSetCompleted}
          />
        ))}
      </ul>

      <Button variant="secondary" onClick={() => void addSetToExercise(row.id)}>
        Add set
      </Button>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={exercise.name}
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            className={MENU_BUTTON}
            disabled={index === 0}
            onClick={() => {
              setMenuOpen(false)
              onMove(-1)
            }}
          >
            Move up
          </Button>
          <Button
            variant="secondary"
            className={MENU_BUTTON}
            disabled={index === count - 1}
            onClick={() => {
              setMenuOpen(false)
              onMove(1)
            }}
          >
            Move down
          </Button>
          <Button
            variant="secondary"
            className={MENU_BUTTON}
            onClick={() => {
              setMenuOpen(false)
              setReplaceOpen(true)
            }}
          >
            Replace exercise
          </Button>
          <Button
            variant="secondary"
            className={MENU_BUTTON}
            onClick={() => {
              setMenuOpen(false)
              setNoteOpen(true)
            }}
          >
            {row.notes ? 'Edit note' : 'Add note'}
          </Button>
          <Link
            to={`/exercises/${row.exerciseId}`}
            className="tap-target flex items-center rounded-control bg-surface-2 px-4 py-2 font-semibold active:bg-border"
          >
            View history
          </Link>
          <Button
            variant="danger"
            className={MENU_BUTTON}
            onClick={() => {
              setMenuOpen(false)
              setRemoveOpen(true)
            }}
          >
            Remove exercise
          </Button>
        </div>
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Note">
        <NoteEditor
          initial={row.notes}
          onSave={(note) => {
            setNoteOpen(false)
            void updateWorkoutExerciseNotes(row.id, note)
          }}
        />
      </Sheet>

      <ExercisePicker
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        single
        title="Replace exercise"
        onConfirm={([chosen]) => {
          setReplaceOpen(false)
          if (chosen) void replaceWorkoutExercise(row.id, chosen.id)
        }}
      />

      <Dialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={`Remove ${exercise.name}?`}
      >
        <p className="mb-4 text-muted">
          Its sets are deleted from this workout.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setRemoveOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              setRemoveOpen(false)
              void removeWorkoutExercise(row.id)
            }}
          >
            Remove
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
