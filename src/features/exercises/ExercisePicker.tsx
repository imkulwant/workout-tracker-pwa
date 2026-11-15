import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import {
  listExercises,
  listRecentExerciseIds,
} from '../../data/repositories/exercises'
import {
  EQUIPMENT_LABELS,
  filterExercises,
  splitRecent,
} from '../../domain/exercises'
import { MUSCLE_LABELS } from '../../domain/muscles'
import type { Exercise, Id } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'

export interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  /** Called with the chosen exercises, in the order they were tapped. */
  onConfirm: (exercises: Exercise[]) => void
}

/**
 * A sheet for choosing one or more exercises: recently used first, then the
 * rest alphabetically. Archived exercises are not offered. The sheet only
 * renders its contents while open, so each opening starts with a clean search
 * and no selection.
 */
export function ExercisePicker({
  open,
  onClose,
  onConfirm,
}: ExercisePickerProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Add exercises">
      <PickerBody onConfirm={onConfirm} />
    </Sheet>
  )
}

function PickRow({
  exercise,
  selected,
  onToggle,
}: {
  exercise: Exercise
  selected: boolean
  onToggle: () => void
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={onToggle}
        className={`tap-target flex w-full items-center gap-3 rounded-control px-3 py-2 text-left ${
          selected ? 'bg-surface-2' : 'active:bg-surface-2'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
            selected
              ? 'border-accent bg-accent text-on-accent'
              : 'border-border'
          }`}
        >
          {selected && '✓'}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{exercise.name}</span>
          <span className="text-sm text-muted">
            {EQUIPMENT_LABELS[exercise.equipment]} ·{' '}
            {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
          </span>
        </span>
      </button>
    </li>
  )
}

function PickerBody({
  onConfirm,
}: {
  onConfirm: (exercises: Exercise[]) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Id[]>([])
  // Archived exercises are left out by default.
  const active = useLiveQuery(() => listExercises())
  const recentIds = useLiveQuery(() => listRecentExerciseIds())

  const { recent, rest } = splitRecent(
    filterExercises(active ?? [], { query }),
    recentIds ?? [],
  )
  const toggle = (id: Id) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id],
    )
  const byId = new Map(
    (active ?? []).map((exercise) => [exercise.id, exercise]),
  )
  const count = selectedIds.length

  const group = (title: string | null, list: Exercise[]) =>
    list.length > 0 && (
      <section className="flex flex-col gap-1">
        {title && <h3 className="px-3 text-sm text-muted">{title}</h3>}
        <ul aria-label={title ?? 'Exercises'} className="flex flex-col">
          {list.map((exercise) => (
            <PickRow
              key={exercise.id}
              exercise={exercise}
              selected={selectedIds.includes(exercise.id)}
              onToggle={() => toggle(exercise.id)}
            />
          ))}
        </ul>
      </section>
    )

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        aria-label="Search exercises"
        placeholder="Search exercises"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        className="tap-target w-full rounded-control border border-border bg-surface-2 px-3 text-text outline-none focus:border-accent"
      />

      {active && recent.length + rest.length === 0 && (
        <p className="px-3 py-6 text-center text-muted">No exercises match.</p>
      )}
      {group('Recent', recent)}
      {group(recent.length > 0 ? 'All exercises' : null, rest)}

      <div className="sticky bottom-0 -mx-4 bg-surface px-4 pt-2 pb-1">
        <Button
          className="w-full"
          disabled={count === 0}
          onClick={() =>
            onConfirm(
              selectedIds.flatMap((id) => {
                const exercise = byId.get(id)
                return exercise ? [exercise] : []
              }),
            )
          }
        >
          {count === 0
            ? 'Add exercises'
            : `Add ${count} ${count === 1 ? 'exercise' : 'exercises'}`}
        </Button>
      </div>
    </div>
  )
}
