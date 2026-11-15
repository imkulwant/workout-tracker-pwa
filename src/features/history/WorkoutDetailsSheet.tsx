import { useState, type FormEvent } from 'react'
import { InvariantError } from '../../data/repositories/common'
import { updateWorkout } from '../../data/repositories/workouts'
import type { Workout } from '../../domain/types'
import { readWorkoutTimes, toTimeOfDay } from '../../domain/workoutEdit'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'

const FIELD =
  'tap-target w-full rounded-control border border-border bg-surface-2 px-3 text-text outline-none focus:border-accent'

export interface WorkoutDetailsSheetProps {
  open: boolean
  workout: Workout
  onClose: () => void
}

/**
 * Edits a finished workout's title, notes, date and times. Changing the date
 * moves the workout in history and every one of its sets with it.
 */
export function WorkoutDetailsSheet({
  open,
  workout,
  onClose,
}: WorkoutDetailsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit workout">
      <DetailsForm workout={workout} onDone={onClose} />
    </Sheet>
  )
}

function DetailsForm({
  workout,
  onDone,
}: {
  workout: Workout
  onDone: () => void
}) {
  const initialStart = toTimeOfDay(workout.startedAt)
  const initialEnd =
    workout.endedAt === null ? '' : toTimeOfDay(workout.endedAt)
  const [title, setTitle] = useState(workout.title)
  const [notes, setNotes] = useState(workout.notes)
  const [date, setDate] = useState<string>(workout.date)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const times = readWorkoutTimes({ date, start, end })
    if (!times.ok) {
      setError(times.error)
      return
    }
    // Times are left exactly as stored unless one of them was changed.
    const timesChanged =
      date !== workout.date || start !== initialStart || end !== initialEnd
    try {
      await updateWorkout(workout.id, {
        title: title.trim(),
        notes: notes.trim(),
        ...(timesChanged && {
          date: times.date,
          startedAt: times.startedAt,
          endedAt: times.endedAt,
        }),
      })
      onDone()
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
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={FIELD}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Start time
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          End time
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className={FIELD}
          />
        </label>
      </div>
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
      <Button type="submit">Save details</Button>
    </form>
  )
}
