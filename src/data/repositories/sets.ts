import {
  isValidReps,
  isValidWeightKg,
  roundWeightKg,
} from '../../domain/numbers'
import type {
  EpochMs,
  Id,
  LocalDate,
  SetType,
  Workout,
  WorkoutSet,
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

const SET_TYPES: readonly SetType[] = ['working', 'warmup', 'drop', 'failure']

export interface SetValues {
  type?: SetType
  weightKg?: number | null
  reps?: number | null
  completedAt?: EpochMs | null
}

/** Rejects out-of-range values and rounds the weight to two decimals. */
function checkValues<T extends SetValues>(values: T): T {
  if (values.type !== undefined && !SET_TYPES.includes(values.type)) {
    throw new InvariantError(`Unknown set type: ${values.type}`)
  }
  const { reps, weightKg } = values
  if (reps != null && !isValidReps(reps)) {
    throw new InvariantError('Reps must be a whole number from 1 to 999')
  }
  if (weightKg != null && !isValidWeightKg(weightKg)) {
    throw new InvariantError('Weight must be from 0 to 1000 kg')
  }
  return weightKg != null
    ? { ...values, weightKg: roundWeightKg(weightKg) }
    : values
}

/**
 * Adds a set at the end of an exercise. The workout id, exercise id and date
 * are copied onto the set, so stats queries need no joins.
 */
export async function addSet(
  workoutExerciseId: Id,
  values: SetValues = {},
): Promise<WorkoutSet> {
  const checked = checkValues(values)
  return db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.sets],
    async () => {
      const parent = requireLive(
        await db.workoutExercises.get(workoutExerciseId),
        'Exercise',
      )
      const workout = requireLive(
        await db.workouts.get(parent.workoutId),
        'Workout',
      )
      const position = await db.sets
        .where('workoutExerciseId')
        .equals(workoutExerciseId)
        .filter(isLive)
        .count()
      const now = Date.now()
      const set: WorkoutSet = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        workoutId: parent.workoutId,
        workoutExerciseId,
        exerciseId: parent.exerciseId,
        date: workout.date,
        position,
        type: checked.type ?? 'working',
        weightKg: checked.weightKg ?? null,
        reps: checked.reps ?? null,
        completedAt: checked.completedAt ?? null,
      }
      await db.sets.add(set)
      return set
    },
  )
}

export async function updateSet(id: Id, patch: SetValues): Promise<WorkoutSet> {
  const checked = checkValues(patch)
  return db.transaction('rw', db.sets, async () => {
    const current = requireLive(await db.sets.get(id), 'Set')
    const next: WorkoutSet = {
      ...current,
      type: checked.type ?? current.type,
      weightKg:
        checked.weightKg !== undefined ? checked.weightKg : current.weightKg,
      reps: checked.reps !== undefined ? checked.reps : current.reps,
      completedAt:
        checked.completedAt !== undefined
          ? checked.completedAt
          : current.completedAt,
      updatedAt: Date.now(),
    }
    await db.sets.put(next)
    return next
  })
}

/** Soft-deletes a set and closes the gap in the remaining positions. */
export async function deleteSet(id: Id): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const target = requireLive(await db.sets.get(id), 'Set')
    const now = Date.now()
    await db.sets.put(tombstone(target, now))

    const siblings = await db.sets
      .where('workoutExerciseId')
      .equals(target.workoutExerciseId)
      .filter(isLive)
      .toArray()
    await db.sets.bulkPut(repack(siblings, now))
  })
}

export async function getSet(id: Id): Promise<WorkoutSet | undefined> {
  return liveOrUndefined(await db.sets.get(id))
}

export async function listSets(workoutExerciseId: Id): Promise<WorkoutSet[]> {
  return db.sets
    .where('workoutExerciseId')
    .equals(workoutExerciseId)
    .filter(isLive)
    .sortBy('position')
}

export interface CountableSetsQuery {
  /** Inclusive. */
  fromDate?: LocalDate
  /** Inclusive. */
  toDate?: LocalDate
  exerciseId?: Id
}

/**
 * The sets that may count towards a metric: ticked sets of completed,
 * non-deleted workouts. Metrics read sets through this, so an unticked set can
 * never be counted. Warm-up sets are included here, because excluding them is
 * a metric rule. Ordered by date, then completion time.
 */
export async function listCountableSets(
  query: CountableSetsQuery = {},
): Promise<WorkoutSet[]> {
  const from = query.fromDate ?? ''
  const to = query.toDate ?? '￿'
  const candidates = query.exerciseId
    ? db.sets
        .where('[exerciseId+date]')
        .between([query.exerciseId, from], [query.exerciseId, to], true, true)
    : db.sets.where('date').between(from, to, true, true)

  const ticked = await candidates
    .filter((s) => isLive(s) && s.completedAt !== null)
    .toArray()
  const workoutIds = [...new Set(ticked.map((s) => s.workoutId))]
  const counted = new Set(
    (await db.workouts.bulkGet(workoutIds))
      .filter((w): w is Workout => w !== undefined)
      .filter((w) => isLive(w) && w.status === 'completed')
      .map((w) => w.id),
  )
  return ticked
    .filter((s) => counted.has(s.workoutId))
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.completedAt! - b.completedAt!,
    )
}

/**
 * The completed sets of the exercise from its latest earlier session: the
 * most recent completed workout that started before `beforeWorkoutId` and has
 * at least one completed set of the exercise. Ordered by position.
 */
export async function getPreviousPerformance(
  exerciseId: Id,
  beforeWorkoutId: Id,
): Promise<WorkoutSet[]> {
  const before = liveOrUndefined(await db.workouts.get(beforeWorkoutId))
  if (!before) return []

  const candidates = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => isLive(s) && s.completedAt !== null)
    .toArray()
  const workoutIds = [...new Set(candidates.map((s) => s.workoutId))]
  const earlier = (await db.workouts.bulkGet(workoutIds)).filter(
    (w): w is Workout =>
      w !== undefined &&
      isLive(w) &&
      w.status === 'completed' &&
      w.startedAt < before.startedAt,
  )
  const latest = earlier.reduce<Workout | undefined>(
    (best, w) => (!best || w.startedAt > best.startedAt ? w : best),
    undefined,
  )
  if (!latest) return []

  return candidates
    .filter((s) => s.workoutId === latest.id)
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
}

/** Every live set of a workout, in exercise order and then set order. */
export async function listWorkoutSets(workoutId: Id): Promise<WorkoutSet[]> {
  const exercises = await db.workoutExercises
    .where('workoutId')
    .equals(workoutId)
    .filter(isLive)
    .toArray()
  const order = new Map(exercises.map((e) => [e.id, e.position]))
  const sets = await db.sets
    .where('workoutId')
    .equals(workoutId)
    .filter((s) => isLive(s) && order.has(s.workoutExerciseId))
    .toArray()
  return sets.sort(
    (a, b) =>
      order.get(a.workoutExerciseId)! - order.get(b.workoutExerciseId)! ||
      a.position - b.position,
  )
}

/**
 * Undoes `deleteSet`: puts the set back at the position it had, and moves the
 * sets after it down to make room, so positions stay contiguous.
 */
export async function restoreSet(id: Id): Promise<WorkoutSet> {
  return db.transaction('rw', [db.workoutExercises, db.sets], async () => {
    const deleted = await db.sets.get(id)
    if (!deleted || isLive(deleted)) {
      throw new InvariantError('That set was not deleted')
    }
    requireLive(
      await db.workoutExercises.get(deleted.workoutExerciseId),
      'Exercise',
    )
    const now = Date.now()
    const siblings = (
      await db.sets
        .where('workoutExerciseId')
        .equals(deleted.workoutExerciseId)
        .filter(isLive)
        .toArray()
    ).sort((a, b) => a.position - b.position)
    const index = Math.min(deleted.position, siblings.length)
    const ordered: WorkoutSet[] = [
      ...siblings.slice(0, index),
      { ...deleted, deletedAt: null },
      ...siblings.slice(index),
    ]
    const changed = ordered.flatMap((set, position) =>
      set.id === id || set.position !== position
        ? [{ ...set, position, updatedAt: now }]
        : [],
    )
    await db.sets.bulkPut(changed)
    return changed.find((set) => set.id === id)!
  })
}

/**
 * Discards the sets of a workout that were never ticked, and any exercise left
 * with no sets, so a finished workout holds only what was done. The sets and
 * exercises that remain are renumbered. Returns how many sets were discarded.
 */
export async function discardIncompleteSets(workoutId: Id): Promise<number> {
  return db.transaction('rw', [db.workoutExercises, db.sets], async () => {
    const now = Date.now()
    const live = await db.sets
      .where('workoutId')
      .equals(workoutId)
      .filter(isLive)
      .toArray()
    const incomplete = live.filter((s) => s.completedAt === null)
    await db.sets.bulkPut(incomplete.map((s) => tombstone(s, now)))

    const kept = new Map<Id, WorkoutSet[]>()
    for (const set of live.filter((s) => s.completedAt !== null)) {
      kept.set(set.workoutExerciseId, [
        ...(kept.get(set.workoutExerciseId) ?? []),
        set,
      ])
    }
    for (const sets of kept.values()) {
      await db.sets.bulkPut(repack(sets, now))
    }

    const exercises = await db.workoutExercises
      .where('workoutId')
      .equals(workoutId)
      .filter(isLive)
      .toArray()
    await db.workoutExercises.bulkPut(
      exercises.filter((e) => !kept.has(e.id)).map((e) => tombstone(e, now)),
    )
    await db.workoutExercises.bulkPut(
      repack(
        exercises.filter((e) => kept.has(e.id)),
        now,
      ),
    )
    return incomplete.length
  })
}

/**
 * The live sets of several workouts at once, grouped by workout and in logging
 * order, for lists that show a total per workout. Sets of removed exercises
 * are left out, as in `listWorkoutSets`.
 */
export async function listSetsByWorkout(
  workoutIds: readonly Id[],
): Promise<Map<Id, WorkoutSet[]>> {
  const grouped = new Map<Id, WorkoutSet[]>(workoutIds.map((id) => [id, []]))
  if (workoutIds.length === 0) return grouped
  const exercises = await db.workoutExercises
    .where('workoutId')
    .anyOf(workoutIds)
    .filter(isLive)
    .toArray()
  const order = new Map(exercises.map((e) => [e.id, e.position]))
  const sets = await db.sets
    .where('workoutId')
    .anyOf(workoutIds)
    .filter((s) => isLive(s) && order.has(s.workoutExerciseId))
    .toArray()
  for (const set of sets) grouped.get(set.workoutId)?.push(set)
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        order.get(a.workoutExerciseId)! - order.get(b.workoutExerciseId)! ||
        a.position - b.position,
    )
  }
  return grouped
}
