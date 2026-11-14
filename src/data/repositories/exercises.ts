import { findMuscleProblem, toNameKey } from '../../domain/exercises'
import type {
  Equipment,
  Exercise,
  Id,
  LoadType,
  MuscleId,
} from '../../domain/types'
import { db } from '../db'
import {
  InvariantError,
  isLive,
  liveOrUndefined,
  newId,
  requireLive,
} from './common'

const DEFAULT_INCREMENT_KG = 2.5

export interface ExerciseInput {
  name: string
  equipment: Equipment
  loadType: LoadType
  primaryMuscles: MuscleId[]
  secondaryMuscles?: MuscleId[]
  notes?: string
  defaultRestSec?: number | null
  incrementKg?: number
}

function validate(exercise: Exercise): void {
  if (exercise.name === '')
    throw new InvariantError('Exercise name is required')
  const problem = findMuscleProblem(
    exercise.primaryMuscles,
    exercise.secondaryMuscles,
  )
  if (problem) throw new InvariantError(problem)
  if (!(exercise.incrementKg > 0)) {
    throw new InvariantError('Increment must be greater than 0')
  }
  const rest = exercise.defaultRestSec
  if (rest !== null && (!Number.isInteger(rest) || rest < 0)) {
    throw new InvariantError('Rest must be a whole number of seconds')
  }
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const now = Date.now()
  const exercise: Exercise = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: input.name.trim(),
    nameKey: toNameKey(input.name),
    equipment: input.equipment,
    loadType: input.loadType,
    primaryMuscles: [...input.primaryMuscles],
    secondaryMuscles: [...(input.secondaryMuscles ?? [])],
    isCustom: true,
    notes: input.notes ?? '',
    defaultRestSec: input.defaultRestSec ?? null,
    incrementKg: input.incrementKg ?? DEFAULT_INCREMENT_KG,
    archivedAt: null,
  }
  validate(exercise)
  await db.exercises.add(exercise)
  return exercise
}

export async function updateExercise(
  id: Id,
  patch: Partial<ExerciseInput>,
): Promise<Exercise> {
  return db.transaction('rw', db.exercises, async () => {
    const current = requireLive(await db.exercises.get(id), 'Exercise')
    const name = patch.name !== undefined ? patch.name.trim() : current.name
    const next: Exercise = {
      ...current,
      name,
      nameKey: toNameKey(name),
      equipment: patch.equipment ?? current.equipment,
      loadType: patch.loadType ?? current.loadType,
      primaryMuscles: patch.primaryMuscles
        ? [...patch.primaryMuscles]
        : current.primaryMuscles,
      secondaryMuscles: patch.secondaryMuscles
        ? [...patch.secondaryMuscles]
        : current.secondaryMuscles,
      notes: patch.notes ?? current.notes,
      defaultRestSec:
        patch.defaultRestSec !== undefined
          ? patch.defaultRestSec
          : current.defaultRestSec,
      incrementKg: patch.incrementKg ?? current.incrementKg,
      updatedAt: Date.now(),
    }
    validate(next)
    await db.exercises.put(next)
    return next
  })
}

/** Hides the exercise from the picker while keeping it in history. */
export async function archiveExercise(id: Id): Promise<Exercise> {
  return setArchived(id, true)
}

export async function unarchiveExercise(id: Id): Promise<Exercise> {
  return setArchived(id, false)
}

async function setArchived(id: Id, archived: boolean): Promise<Exercise> {
  return db.transaction('rw', db.exercises, async () => {
    const current = requireLive(await db.exercises.get(id), 'Exercise')
    const now = Date.now()
    const archivedAt = archived ? (current.archivedAt ?? now) : null
    const next = { ...current, archivedAt, updatedAt: now }
    await db.exercises.put(next)
    return next
  })
}

/**
 * Soft-deletes an exercise that nothing refers to. An exercise used by a
 * workout or a template must be archived instead.
 */
export async function deleteExercise(id: Id): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.workoutExercises, db.templates],
    async () => {
      const current = requireLive(await db.exercises.get(id), 'Exercise')
      const inWorkout = await db.workoutExercises
        .where('exerciseId')
        .equals(id)
        .filter(isLive)
        .count()
      const inTemplate = await db.templates
        .filter((t) => isLive(t) && t.items.some((i) => i.exerciseId === id))
        .count()
      if (inWorkout > 0 || inTemplate > 0) {
        throw new InvariantError(
          'This exercise is in use. Archive it instead of deleting it.',
        )
      }
      const now = Date.now()
      await db.exercises.put({ ...current, deletedAt: now, updatedAt: now })
    },
  )
}

/** Archived exercises are still returned, so history can show them. */
export async function getExercise(id: Id): Promise<Exercise | undefined> {
  return liveOrUndefined(await db.exercises.get(id))
}

export async function listExercises(
  options: { includeArchived?: boolean } = {},
): Promise<Exercise[]> {
  return db.exercises
    .orderBy('nameKey')
    .filter((e) => isLive(e) && (options.includeArchived || !e.archivedAt))
    .toArray()
}
