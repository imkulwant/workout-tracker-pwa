import { z } from 'zod'
import { isLocalDate } from '../../domain/dates'
import { EQUIPMENT, LOAD_TYPES } from '../../domain/exercises'
import { MUSCLE_IDS } from '../../domain/muscles'
import type {
  Equipment,
  Exercise,
  LoadType,
  MuscleId,
  Setting,
  Template,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../../domain/types'

export const BACKUP_FORMAT = 'workout-tracker-backup'
export const BACKUP_SCHEMA_VERSION = 1

const id = z.string().min(1)
const epochMs = z.number().int().nonnegative()
const localDate = z.string().refine(isLocalDate, 'Not a date (YYYY-MM-DD)')
const entity = {
  id,
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt: epochMs.nullable(),
}
const muscle = z.enum(MUSCLE_IDS as [MuscleId, ...MuscleId[]])

const exercise = z.strictObject({
  ...entity,
  name: z.string().min(1),
  nameKey: z.string().min(1),
  equipment: z.enum(EQUIPMENT as [Equipment, ...Equipment[]]),
  loadType: z.enum(LOAD_TYPES as [LoadType, ...LoadType[]]),
  primaryMuscles: z.array(muscle).min(1),
  secondaryMuscles: z.array(muscle),
  isCustom: z.boolean(),
  notes: z.string(),
  defaultRestSec: z.number().int().nonnegative().nullable(),
  incrementKg: z.number().positive(),
  archivedAt: epochMs.nullable(),
})

const workout = z.strictObject({
  ...entity,
  date: localDate,
  startedAt: epochMs,
  endedAt: epochMs.nullable(),
  status: z.enum(['active', 'completed']),
  title: z.string(),
  notes: z.string(),
  templateId: id.nullable(),
})

const workoutExercise = z.strictObject({
  ...entity,
  workoutId: id,
  exerciseId: id,
  position: z.number().int().nonnegative(),
  notes: z.string(),
})

const workoutSet = z.strictObject({
  ...entity,
  workoutId: id,
  workoutExerciseId: id,
  exerciseId: id,
  date: localDate,
  position: z.number().int().nonnegative(),
  type: z.enum(['working', 'warmup', 'drop', 'failure']),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(1).max(999).nullable(),
  completedAt: epochMs.nullable(),
})

const template = z.strictObject({
  ...entity,
  name: z.string().min(1),
  notes: z.string(),
  items: z.array(
    z.strictObject({
      exerciseId: id,
      targetSets: z.number().int().positive(),
      targetReps: z.number().int().positive().nullable(),
      restSec: z.number().int().nonnegative().nullable(),
    }),
  ),
})

// `activeRestTimer` is never exported, so a file that has one is not ours.
const setting = z.discriminatedUnion('key', [
  z.strictObject({
    key: z.literal('defaultRestSec'),
    value: z.number().int().nonnegative(),
    updatedAt: epochMs,
  }),
  z.strictObject({
    key: z.literal('wakeLockEnabled'),
    value: z.boolean(),
    updatedAt: epochMs,
  }),
  z.strictObject({
    key: z.literal('restSoundEnabled'),
    value: z.boolean(),
    updatedAt: epochMs,
  }),
  z.strictObject({
    key: z.literal('calendarMetric'),
    value: z.enum(['sets', 'volume', 'duration']),
    updatedAt: epochMs,
  }),
  z.strictObject({
    key: z.literal('lastBackupAt'),
    value: epochMs.nullable(),
    updatedAt: epochMs,
  }),
  z.strictObject({
    key: z.literal('seedVersion'),
    value: z.number().int().nonnegative().nullable(),
    updatedAt: epochMs,
  }),
])

export const backupSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: epochMs,
  appVersion: z.string().min(1),
  data: z.strictObject({
    exercises: z.array(exercise),
    workouts: z.array(workout),
    workoutExercises: z.array(workoutExercise),
    sets: z.array(workoutSet),
    templates: z.array(template),
    settings: z.array(setting),
  }),
})

export interface BackupData {
  exercises: Exercise[]
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: WorkoutSet[]
  templates: Template[]
  settings: Setting[]
}

export interface Backup {
  format: typeof BACKUP_FORMAT
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  exportedAt: number
  appVersion: string
  data: BackupData
}

export type ParseResult =
  { ok: true; backup: Backup } | { ok: false; error: string }

function duplicate(rows: readonly { id: string }[]): string | null {
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.id)) return row.id
    seen.add(row.id)
  }
  return null
}

/** The first row that points at something the file does not hold, or null. */
function brokenReference(data: BackupData): string | null {
  const exercises = new Set(data.exercises.map((e) => e.id))
  const workouts = new Set(data.workouts.map((w) => w.id))
  const rows = new Set(data.workoutExercises.map((e) => e.id))
  for (const row of data.workoutExercises) {
    if (!workouts.has(row.workoutId))
      return `exercise row ${row.id} has no workout`
    if (!exercises.has(row.exerciseId))
      return `exercise row ${row.id} has no exercise`
  }
  for (const set of data.sets) {
    if (!workouts.has(set.workoutId)) return `set ${set.id} has no workout`
    if (!rows.has(set.workoutExerciseId))
      return `set ${set.id} has no exercise row`
    if (!exercises.has(set.exerciseId)) return `set ${set.id} has no exercise`
  }
  return null
}

/**
 * Reads the text of a backup file. Nothing is written here: the result says
 * whether the file is one this app wrote and holds together, and why not.
 */
export function parseBackup(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This is not a backup file (it is not JSON).' }
  }
  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
    return {
      ok: false,
      error: `This is not a valid backup${where}: ${issue?.message ?? 'unknown problem'}.`,
    }
  }
  const backup = parsed.data as Backup
  for (const [table, rows] of Object.entries(backup.data)) {
    if (table === 'settings') continue
    const dup = duplicate(rows as { id: string }[])
    if (dup)
      return { ok: false, error: `The ${table} table repeats the id ${dup}.` }
  }
  const broken = brokenReference(backup.data)
  if (broken)
    return { ok: false, error: `The backup is inconsistent: ${broken}.` }
  return { ok: true, backup }
}
