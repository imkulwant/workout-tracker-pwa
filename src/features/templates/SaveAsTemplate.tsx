import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { InvariantError } from '../../data/repositories/common'
import { createTemplateFromWorkout } from '../../data/repositories/templates'
import type { Id } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { useToast } from '../../ui/Toast'

/** A button and dialog that save a finished workout as a template. */
export function SaveAsTemplate({
  workoutId,
  defaultName,
}: {
  workoutId: Id
  defaultName: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Save as template
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Save as template"
      >
        <NameForm
          workoutId={workoutId}
          defaultName={defaultName}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  )
}

function NameForm({
  workoutId,
  defaultName,
  onDone,
}: {
  workoutId: Id
  defaultName: string
  onDone: () => void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await createTemplateFromWorkout(workoutId, name)
      onDone()
      toast.show({
        message: 'Template saved',
        actionLabel: 'View',
        onAction: () => void navigate('/templates'),
      })
    } catch (caught) {
      setError(
        caught instanceof InvariantError ? caught.message : 'Could not save.',
      )
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm text-muted">
        Template name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className="tap-target w-full rounded-control border border-border bg-surface-2 px-3 text-text outline-none focus:border-accent"
        />
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save
        </Button>
      </div>
    </form>
  )
}
