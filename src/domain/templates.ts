import type {
  EpochMs,
  Id,
  Template,
  TemplateItem,
  WorkoutExercise,
  WorkoutSet,
} from './types'

/**
 * The plan for a template made from a finished workout: its exercises in
 * order, each with as many target sets as were completed and the reps of the
 * first completed working set. Exercises with no completed set are left out.
 * Rest is left to the exercise's own and the global default.
 */
export function itemsFromWorkout(
  rows: readonly Pick<WorkoutExercise, 'id' | 'exerciseId' | 'position'>[],
  sets: readonly Pick<
    WorkoutSet,
    'workoutExerciseId' | 'type' | 'reps' | 'completedAt' | 'position'
  >[],
): TemplateItem[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .flatMap((row): TemplateItem[] => {
      const done = sets
        .filter((s) => s.workoutExerciseId === row.id && s.completedAt !== null)
        .sort((a, b) => a.position - b.position)
      if (done.length === 0) return []
      const firstWorking = done.find((s) => s.type === 'working')
      return [
        {
          exerciseId: row.exerciseId,
          targetSets: done.length,
          targetReps: firstWorking?.reps ?? null,
          restSec: null,
        },
      ]
    })
}

export interface TemplateUse {
  template: Template
  /** When a workout last started from it, or null if none has. */
  lastUsedAt: EpochMs | null
}

/**
 * Templates sorted by last use, newest first. Ones never used follow, the
 * most recently edited first, then by name.
 */
export function sortByLastUsed(
  templates: readonly Template[],
  usedAt: ReadonlyMap<Id, EpochMs>,
): TemplateUse[] {
  return templates
    .map((template) => ({
      template,
      lastUsedAt: usedAt.get(template.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.lastUsedAt !== null && b.lastUsedAt !== null) {
        return b.lastUsedAt - a.lastUsedAt
      }
      if (a.lastUsedAt !== null) return -1
      if (b.lastUsedAt !== null) return 1
      return (
        b.template.updatedAt - a.template.updatedAt ||
        a.template.name.localeCompare(b.template.name)
      )
    })
}

/** Moves the item at `index` one place up (-1) or down (1). Returns the same list if it cannot move. */
export function moveItem<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return [...items]
  const next = [...items]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

export interface TemplateItemInput {
  exerciseId: Id
  /** What was typed: whole numbers, or empty for reps and rest. */
  sets: string
  reps: string
  rest: string
}

export type TemplateItemResult =
  { ok: true; item: TemplateItem } | { ok: false; error: string }

const WHOLE = /^\d+$/

/** Turns the typed target sets, reps and rest of one item into a template item. */
export function readTemplateItem(input: TemplateItemInput): TemplateItemResult {
  const sets = input.sets.trim()
  if (!WHOLE.test(sets) || Number(sets) < 1) {
    return { ok: false, error: 'Sets must be a whole number of at least 1.' }
  }
  const reps = input.reps.trim()
  if (
    reps !== '' &&
    (!WHOLE.test(reps) || Number(reps) < 1 || Number(reps) > 999)
  ) {
    return { ok: false, error: 'Reps must be a whole number from 1 to 999.' }
  }
  const rest = input.rest.trim()
  if (rest !== '' && !WHOLE.test(rest)) {
    return { ok: false, error: 'Rest must be a whole number of seconds.' }
  }
  return {
    ok: true,
    item: {
      exerciseId: input.exerciseId,
      targetSets: Number(sets),
      targetReps: reps === '' ? null : Number(reps),
      restSec: rest === '' ? null : Number(rest),
    },
  }
}
