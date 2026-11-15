import { isLive } from '../repositories/common'
import { db } from '../db'

export const CSV_HEADER = [
  'date',
  'workout',
  'exercise',
  'set',
  'type',
  'kg',
  'reps',
]

/**
 * One CSV cell. Quotes are doubled and the cell is wrapped when it holds a
 * comma, quote or line break. A cell a spreadsheet would read as a formula
 * gets a leading apostrophe, so a workout titled "=1+1" stays text.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const csvLine = (cells: (string | number | null)[]): string =>
  cells.map(csvCell).join(',')

/**
 * Every completed set that is not deleted, one row each, in the order they
 * were done: date, workout title, exercise, set number, type, kg and reps.
 * Rows end with CRLF, as RFC 4180 says.
 */
export async function buildCsv(): Promise<string> {
  const [workouts, rows, sets, exercises] = await Promise.all([
    db.workouts.filter(isLive).toArray(),
    db.workoutExercises.filter(isLive).toArray(),
    db.sets.filter((s) => isLive(s) && s.completedAt !== null).toArray(),
    db.exercises.toArray(),
  ])
  const workoutById = new Map(workouts.map((w) => [w.id, w]))
  const rowById = new Map(rows.map((r) => [r.id, r]))
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))

  const lines = sets
    .flatMap((set) => {
      const workout = workoutById.get(set.workoutId)
      const row = rowById.get(set.workoutExerciseId)
      return workout && row ? [{ set, workout, row }] : []
    })
    .sort(
      (a, b) =>
        a.workout.startedAt - b.workout.startedAt ||
        a.row.position - b.row.position ||
        a.set.position - b.set.position,
    )
    .map(({ set, workout }) =>
      csvLine([
        set.date,
        workout.title || 'Workout',
        exerciseById.get(set.exerciseId)?.name ?? '',
        set.position + 1,
        set.type,
        set.weightKg,
        set.reps,
      ]),
    )
  return [csvLine(CSV_HEADER), ...lines].join('\r\n') + '\r\n'
}

/** `workout-tracker-sets-2026-11-15.csv` */
export const csvFileName = (isoDate: string): string =>
  `workout-tracker-sets-${isoDate}.csv`
