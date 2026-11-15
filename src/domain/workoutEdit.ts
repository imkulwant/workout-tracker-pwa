import { isLocalDate } from './dates'
import type { EpochMs, LocalDate } from './types'

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

const pad = (n: number) => String(n).padStart(2, '0')

/** The local clock time of an instant, as `HH:MM`. */
export function toTimeOfDay(epochMs: EpochMs): string {
  const d = new Date(epochMs)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The instant of a local date and `HH:MM` time, or null if either is not valid. */
export function fromDateAndTime(date: string, time: string): EpochMs | null {
  const match = TIME.exec(time)
  if (!isLocalDate(date) || !match) return null
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  return new Date(
    year,
    month - 1,
    day,
    Number(match[1]),
    Number(match[2]),
  ).getTime()
}

export interface WorkoutTimesInput {
  date: string
  start: string
  end: string
}

export type WorkoutTimesResult =
  | { ok: true; date: LocalDate; startedAt: EpochMs; endedAt: EpochMs }
  | { ok: false; error: string }

/** Checks the date, start and end typed in the editor, and turns them into instants. */
export function readWorkoutTimes(input: WorkoutTimesInput): WorkoutTimesResult {
  if (!isLocalDate(input.date)) return { ok: false, error: 'Enter a date.' }
  const startedAt = fromDateAndTime(input.date, input.start)
  if (startedAt === null) return { ok: false, error: 'Enter a start time.' }
  const endedAt = fromDateAndTime(input.date, input.end)
  if (endedAt === null) return { ok: false, error: 'Enter an end time.' }
  if (endedAt <= startedAt) {
    return { ok: false, error: 'The end must be after the start.' }
  }
  return { ok: true, date: input.date, startedAt, endedAt }
}
