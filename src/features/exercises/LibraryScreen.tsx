import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { listExercises } from '../../data/repositories/exercises'
import { EQUIPMENT_LABELS, filterExercises } from '../../domain/exercises'
import {
  BODY_PARTS,
  BODY_PART_LABELS,
  MUSCLE_LABELS,
} from '../../domain/muscles'
import type { BodyPart } from '../../domain/types'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { Screen } from '../../ui/Screen'

/** The Exercises tab: search, filter by body part, and open or add one. */
export function LibraryScreen() {
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Re-runs on its own whenever the exercises table changes.
  const all = useLiveQuery(
    () => listExercises({ includeArchived: showArchived }),
    [showArchived],
  )
  const exercises = all ? filterExercises(all, { query, bodyPart }) : []

  return (
    <Screen title="Exercises">
      <div className="flex gap-2">
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
          className="tap-target min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-3 text-text outline-none focus:border-accent"
        />
        <Link
          to="/exercises/new"
          className="tap-target flex items-center rounded-control bg-accent px-4 font-semibold text-on-accent active:bg-accent-strong"
        >
          Add
        </Link>
      </div>

      <div
        role="group"
        aria-label="Filter by body part"
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
        <Chip
          selected={showArchived}
          onClick={() => setShowArchived(!showArchived)}
        >
          Archived
        </Chip>
      </div>

      {all && (
        <p role="status" className="text-sm text-muted">
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        </p>
      )}

      {all && exercises.length === 0 ? (
        <EmptyState
          title="No exercises match"
          description={
            query.trim()
              ? `Nothing is called "${query.trim()}".`
              : 'Nothing matches these filters.'
          }
          action={
            <Link
              className="font-semibold text-accent"
              to={`/exercises/new${
                query.trim() ? `?name=${encodeURIComponent(query.trim())}` : ''
              }`}
            >
              Add it as a new exercise
            </Link>
          }
        />
      ) : (
        <ul aria-label="Exercise list" className="flex flex-col gap-2">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <Link
                to={`/exercises/${exercise.id}`}
                className="tap-target flex flex-col gap-0.5 rounded-control bg-surface px-4 py-3 active:bg-surface-2"
              >
                <span className="flex items-center gap-2 font-semibold">
                  {exercise.name}
                  {exercise.archivedAt && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                      Archived
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted">
                  {EQUIPMENT_LABELS[exercise.equipment]} ·{' '}
                  {exercise.primaryMuscles
                    .map((muscle) => MUSCLE_LABELS[muscle])
                    .join(', ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
