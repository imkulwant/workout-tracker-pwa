import { useState } from 'react'
import { deleteSet, restoreSet, updateSet } from '../../data/repositories/sets'
import { InvariantError } from '../../data/repositories/common'
import { formatPreviousSet, formatWeightKg } from '../../domain/format'
import { readSetEntry, type SetEntryErrors } from '../../domain/setEntry'
import { SET_TYPE_LABELS } from '../../domain/setLabel'
import type { LoadType, SetType, WorkoutSet } from '../../domain/types'
import { unlockAudio } from '../../platform/sound'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'

export const SET_GRID =
  'grid grid-cols-[2.75rem_1fr_4.5rem_4.5rem_2.75rem] items-center gap-2'

const SET_TYPES: SetType[] = ['working', 'warmup', 'drop', 'failure']

/**
 * What is typed in a field and not yet stored, with the stored value it was
 * typed over. A draft is dropped by itself once that field's stored value
 * changes, so the field then shows what is in the database. It is tracked per
 * field: saving the weight must not discard reps typed since.
 */
interface FieldDraft {
  text: string
  from: number | null
}
interface Draft {
  weight?: FieldDraft
  reps?: FieldDraft
}

const cell = (hasError: boolean) =>
  `tap-target w-full min-w-0 rounded-control border bg-surface-2 px-1 text-center text-text outline-none focus:border-accent ${
    hasError ? 'border-danger' : 'border-border'
  }`

export interface SetRowProps {
  set: WorkoutSet
  /** Zero-based place in the exercise, for the accessible names. */
  index: number
  /** The badge text: a number, or W, D or F. */
  label: string
  loadType: LoadType
  /** The same position in the last session of this exercise. */
  previous: WorkoutSet | undefined
  /** Called after a set is ticked, with the stored set. */
  onCompleted?: (set: WorkoutSet) => void
}

/**
 * One set. Values are stored when you leave a field and when you tick the set,
 * and nothing committed is kept only in memory. While you type, a draft shows;
 * it is dropped by itself once that field's stored value changes, so the row
 * always ends up showing what is in the database.
 */
export function SetRow({
  set,
  index,
  label,
  loadType,
  previous,
  onCompleted,
}: SetRowProps) {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>({})
  const [errors, setErrors] = useState<SetEntryErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const weightDraft =
    draft.weight && draft.weight.from === set.weightKg ? draft.weight : null
  const repsDraft =
    draft.reps && draft.reps.from === set.reps ? draft.reps : null
  const weightText = weightDraft?.text ?? formatWeightKg(set.weightKg)
  const repsText =
    repsDraft?.text ?? (set.reps === null ? '' : String(set.reps))
  const done = set.completedAt !== null
  const number = index + 1

  function edit(field: 'weight' | 'reps', raw: string) {
    const text = raw.replace(/[^0-9.,]/g, '')
    setDraft((current) => ({
      ...current,
      [field]: { text, from: field === 'weight' ? set.weightKg : set.reps },
    }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  /** Stores a change. Returns the stored set, or undefined if it was refused. */
  async function write(
    patch: Parameters<typeof updateSet>[1],
  ): Promise<WorkoutSet | undefined> {
    setSaveError(null)
    try {
      return await updateSet(set.id, patch)
    } catch (error) {
      if (error instanceof InvariantError) setErrors({ weight: error.message })
      else setSaveError('Could not save. Your last change was not stored.')
      return undefined
    }
  }

  async function commitFields() {
    if (!weightDraft && !repsDraft) return
    const result = readSetEntry({
      weightText,
      repsText,
      loadType,
      forCompletion: false,
    })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    await write({ weightKg: result.weightKg, reps: result.reps })
  }

  async function toggleComplete() {
    if (done) {
      await write({ completedAt: null })
      return
    }
    // Created during this tap, so iOS allows the rest tone to play later.
    unlockAudio()
    const result = readSetEntry({
      weightText,
      repsText,
      loadType,
      forCompletion: true,
    })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    const stored = await write({
      weightKg: result.weightKg,
      reps: result.reps,
      completedAt: Date.now(),
    })
    if (stored) onCompleted?.(stored)
  }

  async function chooseType(type: SetType) {
    setMenuOpen(false)
    await write({ type })
  }

  async function remove() {
    setMenuOpen(false)
    try {
      await deleteSet(set.id)
    } catch {
      setSaveError('Could not delete the set.')
      return
    }
    toast.show({
      message: 'Set deleted',
      actionLabel: 'Undo',
      onAction: () => void restoreSet(set.id),
    })
  }

  const problem = [errors.weight, errors.reps, saveError]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={`${SET_GRID} rounded-control px-1 py-1 ${done ? 'bg-accent/10' : ''}`}
    >
      <button
        type="button"
        aria-label={`Set ${number} options`}
        onClick={() => setMenuOpen(true)}
        className="tap-target rounded-control bg-surface-2 font-semibold active:bg-border"
      >
        {label}
      </button>

      <span className="truncate text-sm text-muted">
        {previous ? formatPreviousSet(previous) : '–'}
      </span>

      <input
        type="text"
        inputMode="decimal"
        aria-label={`Weight for set ${number}`}
        aria-invalid={errors.weight ? true : undefined}
        value={weightText}
        onChange={(event) => edit('weight', event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => void commitFields()}
        autoComplete="off"
        enterKeyHint="next"
        className={cell(Boolean(errors.weight))}
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Reps for set ${number}`}
        aria-invalid={errors.reps ? true : undefined}
        value={repsText}
        onChange={(event) => edit('reps', event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => void commitFields()}
        autoComplete="off"
        enterKeyHint="done"
        className={cell(Boolean(errors.reps))}
      />

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Complete set ${number}`}
        onClick={() => void toggleComplete()}
        className={`tap-target flex items-center justify-center rounded-control text-lg font-bold ${
          done
            ? 'bg-accent text-on-accent'
            : 'bg-surface-2 text-muted active:bg-border'
        }`}
      >
        ✓
      </button>

      {problem && (
        <p role="alert" className="col-span-5 px-1 text-sm text-danger">
          {problem}
        </p>
      )}

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={`Set ${number}`}
      >
        <p className="mb-2 text-sm text-muted">Set type</p>
        <div
          role="group"
          aria-label="Set type"
          className="mb-4 flex flex-wrap gap-2"
        >
          {SET_TYPES.map((type) => (
            <Chip
              key={type}
              selected={set.type === type}
              onClick={() => void chooseType(type)}
            >
              {SET_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => void remove()}
        >
          Delete set
        </Button>
      </Sheet>
    </li>
  )
}
