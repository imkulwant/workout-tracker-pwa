import { isLocalDate, toLocalDate } from '../../domain/dates'
import type {
  EpochMs,
  Id,
  LocalDate,
  Workout,
  WorkoutExercise,
} from '../../domain/types'
import { db } from '../db'
import {
  InvariantError,
  isLive,
  liveOrUndefined,
  newId,
  repack,
  requireLive,
  tombstone,
} from './common'

export interface StartWorkoutInput {
  title?: string
  templateId?: Id | null
  /** The start time. Defaults to the current time. */
  now?: EpochMs
}

/**
 * Starts a workout. At most one workout can be active, so when one already
 * exists it is returned and nothing is created.
 */
export async function startWorkout(
  input: StartWorkoutInput = {},
): Promise<Workout> {
  return db.transaction('rw', db.workouts, async () => {
    const existing = await db.workouts
      .where('status')
      .equals('active')
      .filter(isLive)
      .first()
    if (existing) return existing

    const startedAt = input.now ?? Date.now()
    const created = Date.now()
    const workout: Workout = {
      id: newId(),
      createdAt: created,
      updatedAt: created,
      deletedAt: null,
      date: toLocalDate(startedAt),
      startedAt,
      endedAt: null,
      status: 'active',
      title: input.title ?? '',
      notes: '',
      templateId: input.templateId ?? null,
    }
    await db.workouts.add(workout)
    return workout
  })
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').filter(isLive).first()
}

export async function getWorkout(id: Id): Promise<Workout | undefined> {
  return liveOrUndefined(await db.workouts.get(id))
}

/** Newest first. */
export async function listWorkouts(): Promise<Workout[]> {
  return db.workouts.orderBy('startedAt').reverse().filter(isLive).toArray()
}

/** Finished workouts, newest first, at most `limit` of them. */
export async function listCompletedWorkouts(limit: number): Promise<Workout[]> {
  return db.workouts
    .orderBy('startedAt')
    .reverse()
    .filter((w) => isLive(w) && w.status === 'completed')
    .limit(limit)
    .toArray()
}

/** How many finished workouts there are. */
export async function countCompletedWorkouts(): Promise<number> {
  return db.workouts
    .filter((w) => isLive(w) && w.status === 'completed')
    .count()
}

export interface WorkoutPatch {
  title?: string
  notes?: string
  date?: LocalDate
  startedAt?: EpochMs
  endedAt?: EpochMs | null
}

/**
 * Edits a workout. The date follows `startedAt` unless it is given explicitly,
 * and a changed date is copied onto every one of the workout's sets, in the
 * same transaction.
 */
export async function updateWorkout(
  id: Id,
  patch: WorkoutPatch,
): Promise<Workout> {
  return db.transaction('rw', [db.workouts, db.sets], async () => {
    const current = requireLive(await db.workouts.get(id), 'Workout')
    const now = Date.now()
    const startedAt = patch.startedAt ?? current.startedAt
    const endedAt =
      patch.endedAt !== undefined ? patch.endedAt : current.endedAt
    if (endedAt !== null && endedAt < startedAt) {
      throw new InvariantError('A workout cannot end before it starts')
    }
    if (patch.date !== undefined && !isLocalDate(patch.date)) {
      throw new InvariantError(`Invalid date: ${patch.date}`)
    }
    const date =
      patch.date ??
      (patch.startedAt !== undefined ? toLocalDate(startedAt) : current.date)

    const next: Workout = {
      ...current,
      title: patch.title ?? current.title,
      notes: patch.notes ?? current.notes,
      date,
      startedAt,
      endedAt,
      updatedAt: now,
    }
    await db.workouts.put(next)

    if (date !== current.date) {
      // Soft-deleted sets are included, so an undo never restores a stale date.
      const sets = await db.sets.where('workoutId').equals(id).toArray()
      await db.sets.bulkPut(sets.map((s) => ({ ...s, date, updatedAt: now })))
    }
    return next
  })
}

/** Completes an active workout. Finishing a completed one changes nothing. */
export async function finishWorkout(
  id: Id,
  endedAt: EpochMs = Date.now(),
): Promise<Workout> {
  return db.transaction('rw', db.workouts, async () => {
    const current = requireLive(await db.workouts.get(id), 'Workout')
    if (current.status === 'completed') return current
    if (endedAt < current.startedAt) {
      throw new InvariantError('A workout cannot end before it starts')
    }
    const next: Workout = {
      ...current,
      status: 'completed',
      endedAt,
      updatedAt: Date.now(),
    }
    await db.workouts.put(next)
    return next
  })
}

/**
 * Soft-deletes a workout together with its exercises and sets. Everything is
 * stamped with the same time, so an undo can find what went with it.
 */
export async function deleteWorkout(id: Id): Promise<void> {
  await db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.sets],
    async () => {
      const workout = requireLive(await db.workouts.get(id), 'Workout')
      const now = Date.now()
      await db.workouts.put(tombstone(workout, now))

      const exercises = await db.workoutExercises
        .where('workoutId')
        .equals(id)
        .filter(isLive)
        .toArray()
      await db.workoutExercises.bulkPut(exercises.map((e) => tombstone(e, now)))

      const sets = await db.sets
        .where('workoutId')
        .equals(id)
        .filter(isLive)
        .toArray()
      await db.sets.bulkPut(sets.map((s) => tombstone(s, now)))
    },
  )
}

/**
 * Undoes `deleteWorkout`: brings back the workout with the exercises and sets
 * that were deleted along with it. Rows deleted earlier, such as a set removed
 * before the workout was, have a different `deletedAt` and stay deleted.
 */
export async function restoreWorkout(id: Id): Promise<Workout> {
  return db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.sets],
    async () => {
      const deleted = await db.workouts.get(id)
      if (!deleted || isLive(deleted)) {
        throw new InvariantError('That workout was not deleted')
      }
      const stamp = deleted.deletedAt
      const now = Date.now()
      const back = <T extends { deletedAt: number | null; updatedAt: number }>(
        row: T,
      ): T => ({ ...row, deletedAt: null, updatedAt: now })

      const exercises = await db.workoutExercises
        .where('workoutId')
        .equals(id)
        .filter((e) => e.deletedAt === stamp)
        .toArray()
      await db.workoutExercises.bulkPut(exercises.map(back))

      const sets = await db.sets
        .where('workoutId')
        .equals(id)
        .filter((s) => s.deletedAt === stamp)
        .toArray()
      await db.sets.bulkPut(sets.map(back))

      const workout = back(deleted)
      await db.workouts.put(workout)
      return workout
    },
  )
}

export async function listWorkoutExercises(
  workoutId: Id,
): Promise<WorkoutExercise[]> {
  return db.workoutExercises
    .where('workoutId')
    .equals(workoutId)
    .filter(isLive)
    .sortBy('position')
}

export async function addExerciseToWorkout(
  workoutId: Id,
  exerciseId: Id,
): Promise<WorkoutExercise> {
  return db.transaction(
    'rw',
    [db.workouts, db.exercises, db.workoutExercises],
    async () => {
      requireLive(await db.workouts.get(workoutId), 'Workout')
      requireLive(await db.exercises.get(exerciseId), 'Exercise')
      const position = await db.workoutExercises
        .where('workoutId')
        .equals(workoutId)
        .filter(isLive)
        .count()
      const now = Date.now()
      const row: WorkoutExercise = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        workoutId,
        exerciseId,
        position,
        notes: '',
      }
      await db.workoutExercises.add(row)
      return row
    },
  )
}

/** Removes an exercise and its sets from a workout, and closes the gap. */
export async function removeWorkoutExercise(id: Id): Promise<void> {
  await db.transaction('rw', [db.workoutExercises, db.sets], async () => {
    const target = requireLive(await db.workoutExercises.get(id), 'Exercise')
    const now = Date.now()
    await db.workoutExercises.put(tombstone(target, now))

    const sets = await db.sets
      .where('workoutExerciseId')
      .equals(id)
      .filter(isLive)
      .toArray()
    await db.sets.bulkPut(sets.map((s) => tombstone(s, now)))

    const siblings = await db.workoutExercises
      .where('workoutId')
      .equals(target.workoutId)
      .filter(isLive)
      .toArray()
    await db.workoutExercises.bulkPut(repack(siblings, now))
  })
}

/** `orderedIds` must list every exercise of the workout exactly once. */
export async function reorderWorkoutExercises(
  workoutId: Id,
  orderedIds: readonly Id[],
): Promise<void> {
  await db.transaction('rw', db.workoutExercises, async () => {
    const current = await db.workoutExercises
      .where('workoutId')
      .equals(workoutId)
      .filter(isLive)
      .toArray()
    const known = new Set(current.map((e) => e.id))
    const sameSet =
      orderedIds.length === known.size &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => known.has(id))
    if (!sameSet) {
      throw new InvariantError(
        'The new order must list each exercise of the workout exactly once',
      )
    }
    const now = Date.now()
    const byId = new Map(current.map((e) => [e.id, e]))
    const changed = orderedIds.flatMap((id, position) => {
      const row = byId.get(id)
      return row && row.position !== position
        ? [{ ...row, position, updatedAt: now }]
        : []
    })
    await db.workoutExercises.bulkPut(changed)
  })
}

export async function getWorkoutExercise(
  id: Id,
): Promise<WorkoutExercise | undefined> {
  return liveOrUndefined(await db.workoutExercises.get(id))
}

/**
 * Swaps the exercise of a workout exercise, keeping its place and its sets.
 * Sets carry a copy of the exercise id, so they are updated in the same
 * transaction, including deleted ones, so an undo is never stale.
 */
export async function replaceWorkoutExercise(
  id: Id,
  exerciseId: Id,
): Promise<WorkoutExercise> {
  return db.transaction(
    'rw',
    [db.workoutExercises, db.exercises, db.sets],
    async () => {
      const current = requireLive(await db.workoutExercises.get(id), 'Exercise')
      requireLive(await db.exercises.get(exerciseId), 'Exercise')
      if (current.exerciseId === exerciseId) return current
      const now = Date.now()
      const next: WorkoutExercise = { ...current, exerciseId, updatedAt: now }
      await db.workoutExercises.put(next)
      const sets = await db.sets.where('workoutExerciseId').equals(id).toArray()
      await db.sets.bulkPut(
        sets.map((set) => ({ ...set, exerciseId, updatedAt: now })),
      )
      return next
    },
  )
}

export async function updateWorkoutExerciseNotes(
  id: Id,
  notes: string,
): Promise<WorkoutExercise> {
  return db.transaction('rw', db.workoutExercises, async () => {
    const current = requireLive(await db.workoutExercises.get(id), 'Exercise')
    const next: WorkoutExercise = { ...current, notes, updatedAt: Date.now() }
    await db.workoutExercises.put(next)
    return next
  })
}
