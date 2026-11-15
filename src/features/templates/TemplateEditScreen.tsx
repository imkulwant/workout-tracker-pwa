import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { InvariantError } from '../../data/repositories/common'
import { listExercises } from '../../data/repositories/exercises'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from '../../data/repositories/templates'
import { moveItem, readTemplateItem } from '../../domain/templates'
import type { Exercise, Id, Template } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { NumberField } from '../../ui/NumberField'
import { Screen } from '../../ui/Screen'
import { useToast } from '../../ui/Toast'
import { ExercisePicker } from '../exercises/ExercisePicker'

interface Row {
  key: number
  exerciseId: Id
  sets: string
  reps: string
  rest: string
}

let nextKey = 1
const rowFor = (
  exerciseId: Id,
  item?: {
    targetSets: number
    targetReps: number | null
    restSec: number | null
  },
): Row => ({
  key: nextKey++,
  exerciseId,
  sets: String(item?.targetSets ?? 3),
  reps:
    item?.targetReps === null || item === undefined
      ? ''
      : String(item.targetReps),
  rest:
    item?.restSec === null || item === undefined ? '' : String(item.restSec),
})

/** `/templates/new`. */
export function NewTemplateScreen() {
  const exercises = useLiveQuery(() => listExercises({ includeArchived: true }))
  if (!exercises) return null
  return <TemplateForm template={null} exercises={exercises} />
}

/** `/templates/:id`. */
export function EditTemplateScreen() {
  const { id = '' } = useParams()
  const loaded = useLiveQuery(async () => {
    const [template, exercises] = await Promise.all([
      getTemplate(id),
      listExercises({ includeArchived: true }),
    ])
    return { template: template ?? null, exercises }
  }, [id])
  if (!loaded) return null
  if (!loaded.template) {
    return (
      <Screen title="Template" back="/templates">
        <EmptyState
          title="Template not found"
          description="It may have been deleted."
        />
      </Screen>
    )
  }
  // The form keeps its own copy while you edit, so a change elsewhere does not overwrite it.
  return (
    <TemplateForm
      key={loaded.template.id}
      template={loaded.template}
      exercises={loaded.exercises}
    />
  )
}

function TemplateForm({
  template,
  exercises,
}: {
  template: Template | null
  exercises: Exercise[]
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const names = new Map(exercises.map((e) => [e.id, e]))
  const [name, setName] = useState(template?.name ?? '')
  const [notes, setNotes] = useState(template?.notes ?? '')
  const [rows, setRows] = useState<Row[]>(
    () => template?.items.map((item) => rowFor(item.exerciseId, item)) ?? [],
  )
  const [picking, setPicking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    )

  async function save() {
    setError(null)
    const items = []
    for (const row of rows) {
      const result = readTemplateItem(row)
      if (!result.ok) {
        setError(
          `${names.get(row.exerciseId)?.name ?? 'An exercise'}: ${result.error}`,
        )
        return
      }
      items.push(result.item)
    }
    try {
      if (template) await updateTemplate(template.id, { name, notes, items })
      else await createTemplate({ name, notes, items })
      void navigate('/templates', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof InvariantError ? caught.message : 'Could not save.',
      )
    }
  }

  async function remove() {
    if (!template) return
    setDeleting(false)
    await deleteTemplate(template.id)
    void navigate('/templates', { replace: true })
    toast.show({ message: 'Template deleted' })
  }

  return (
    <Screen
      title={template ? 'Edit template' : 'New template'}
      back="/templates"
    >
      <label className="flex flex-col gap-1 text-sm text-muted">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className="tap-target w-full rounded-control border border-border bg-surface-2 px-3 text-text outline-none focus:border-accent"
        />
      </label>

      {rows.length === 0 && (
        <p className="text-muted">
          No exercises yet. Add the ones you do in this workout.
        </p>
      )}
      {rows.map((row, index) => {
        const exercise = names.get(row.exerciseId)
        const title = exercise?.name ?? 'Deleted exercise'
        return (
          <section
            key={row.key}
            aria-label={`${title}, exercise ${index + 1}`}
            className="flex flex-col gap-3 rounded-card bg-surface p-3"
          >
            <h2 className="text-lg font-semibold">
              {title}
              {exercise?.archivedAt ? (
                <span className="text-sm font-normal text-muted">
                  {' '}
                  (archived)
                </span>
              ) : null}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Sets"
                inputMode="numeric"
                value={row.sets}
                onChange={(sets) => update(row.key, { sets })}
              />
              <NumberField
                label="Reps"
                inputMode="numeric"
                value={row.reps}
                onChange={(reps) => update(row.key, { reps })}
              />
              <NumberField
                label="Rest (s)"
                inputMode="numeric"
                value={row.rest}
                onChange={(rest) => update(row.key, { rest })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                aria-label={`Move ${title} up`}
                disabled={index === 0}
                onClick={() => setRows(moveItem(rows, index, -1))}
              >
                Move up
              </Button>
              <Button
                variant="secondary"
                aria-label={`Move ${title} down`}
                disabled={index === rows.length - 1}
                onClick={() => setRows(moveItem(rows, index, 1))}
              >
                Move down
              </Button>
              <Button
                variant="ghost"
                aria-label={`Remove ${title}`}
                onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
              >
                Remove
              </Button>
            </div>
          </section>
        )
      })}

      <Button variant="secondary" onClick={() => setPicking(true)}>
        Add exercises
      </Button>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Notes
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
        />
      </label>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button onClick={() => void save()}>Save template</Button>
      {template && (
        <Button variant="danger" onClick={() => setDeleting(true)}>
          Delete template
        </Button>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={(chosen) => {
          setPicking(false)
          setRows((current) => [...current, ...chosen.map((e) => rowFor(e.id))])
        }}
      />
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this template?"
      >
        <p className="mb-4 text-muted">
          Workouts you already did from it are not changed.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDeleting(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => void remove()}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </Screen>
  )
}
