import { useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  DuplicateNameError,
  InvariantError,
} from '../../data/repositories/common'
import {
  createExercise,
  updateExercise,
} from '../../data/repositories/exercises'
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  LOAD_TYPES,
  LOAD_TYPE_LABELS,
} from '../../domain/exercises'
import { MUSCLE_IDS, MUSCLE_LABELS } from '../../domain/muscles'
import type { Id, MuscleId } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { NumberField } from '../../ui/NumberField'
import { useGoBack } from '../../ui/useGoBack'
import {
  toExerciseInput,
  type ExerciseFormErrors,
  type ExerciseFormValues,
} from './formValues'

const FIELD =
  'tap-target w-full rounded-control border bg-surface-2 px-3 text-text outline-none focus:border-accent'

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm text-muted">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function MuscleGroup({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: readonly MuscleId[]
  onToggle: (muscle: MuscleId) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {MUSCLE_IDS.map((muscle) => (
          <Chip
            key={muscle}
            selected={selected.includes(muscle)}
            onClick={() => onToggle(muscle)}
          >
            {MUSCLE_LABELS[muscle]}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export interface ExerciseFormProps {
  initial: ExerciseFormValues
  /** Set when editing: the exercise to update. Create a new one when absent. */
  exerciseId?: Id
  /** Where Back and a finished save go when there is no history. */
  backTo: string
}

/** Creates or edits an exercise. Saving returns to the previous screen. */
export function ExerciseForm({
  initial,
  exerciseId,
  backTo,
}: ExerciseFormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<ExerciseFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const goBack = useGoBack(backTo)
  const nameId = useId()
  const equipmentId = useId()
  const loadTypeId = useId()
  const notesId = useId()

  const set = <K extends keyof ExerciseFormValues>(
    key: K,
    value: ExerciseFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }))

  const toggle = (key: 'primary' | 'secondary', muscle: MuscleId) =>
    setValues((current) => ({
      ...current,
      [key]: current[key].includes(muscle)
        ? current[key].filter((m) => m !== muscle)
        : [...current[key], muscle],
    }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const result = toExerciseInput(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      if (exerciseId) await updateExercise(exerciseId, result.input)
      else await createExercise(result.input)
      goBack()
    } catch (error) {
      if (error instanceof DuplicateNameError)
        setErrors({ name: error.message })
      else if (error instanceof InvariantError) setFormError(error.message)
      else setFormError(`Could not save: ${String(error)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {formError && (
        <p role="alert" className="rounded-control bg-surface p-3 text-danger">
          {formError}
        </p>
      )}

      <Field label="Name" htmlFor={nameId} error={errors.name}>
        <input
          id={nameId}
          type="text"
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          aria-invalid={errors.name ? true : undefined}
          className={`${FIELD} ${errors.name ? 'border-danger' : 'border-border'}`}
        />
      </Field>

      <Field label="Equipment" htmlFor={equipmentId}>
        <select
          id={equipmentId}
          value={values.equipment}
          onChange={(event) =>
            set('equipment', event.target.value as typeof values.equipment)
          }
          className={`${FIELD} border-border`}
        >
          {EQUIPMENT.map((equipment) => (
            <option key={equipment} value={equipment}>
              {EQUIPMENT_LABELS[equipment]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Load type" htmlFor={loadTypeId}>
        <select
          id={loadTypeId}
          value={values.loadType}
          onChange={(event) =>
            set('loadType', event.target.value as typeof values.loadType)
          }
          className={`${FIELD} border-border`}
        >
          {LOAD_TYPES.map((loadType) => (
            <option key={loadType} value={loadType}>
              {LOAD_TYPE_LABELS[loadType]}
            </option>
          ))}
        </select>
      </Field>

      <MuscleGroup
        label="Primary muscles"
        selected={values.primary}
        onToggle={(muscle) => toggle('primary', muscle)}
      />
      <MuscleGroup
        label="Secondary muscles"
        selected={values.secondary}
        onToggle={(muscle) => toggle('secondary', muscle)}
      />
      {errors.muscles && (
        <p role="alert" className="text-sm text-danger">
          {errors.muscles}
        </p>
      )}

      <NumberField
        label="Default rest (optional)"
        unit="s"
        inputMode="numeric"
        value={values.restSec}
        onChange={(value) => set('restSec', value)}
        error={errors.restSec}
      />
      <NumberField
        label="Weight increment"
        unit="kg"
        value={values.incrementKg}
        onChange={(value) => set('incrementKg', value)}
        error={errors.incrementKg}
      />

      <Field label="Notes" htmlFor={notesId}>
        <textarea
          id={notesId}
          rows={3}
          value={values.notes}
          onChange={(event) => set('notes', event.target.value)}
          className={`${FIELD} border-border py-2`}
        />
      </Field>

      <Button type="submit" disabled={saving}>
        {exerciseId ? 'Save changes' : 'Save exercise'}
      </Button>
    </form>
  )
}
