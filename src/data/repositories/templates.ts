import { isValidReps } from '../../domain/numbers'
import { prefillForNewSet, type SetValues } from '../../domain/prefill'
import { itemsFromWorkout } from '../../domain/templates'
import type {
  EpochMs,
  Id,
  Template,
  TemplateItem,
  Workout,
} from '../../domain/types'
import { db } from '../db'
import { addSet, getPreviousPerformance, listWorkoutSets } from './sets'
import {
  addExerciseToWorkout,
  getActiveWorkout,
  listWorkoutExercises,
  startWorkout,
} from './workouts'
import {
  InvariantError,
  isLive,
  liveOrUndefined,
  newId,
  requireLive,
  tombstone,
} from './common'

export interface TemplateInput {
  name: string
  notes?: string
  items?: TemplateItem[]
}

function validate(template: Template): void {
  if (template.name === '')
    throw new InvariantError('Template name is required')
  for (const item of template.items) {
    if (!Number.isInteger(item.targetSets) || item.targetSets < 1) {
      throw new InvariantError(
        'Target sets must be a whole number of at least 1',
      )
    }
    if (item.targetReps !== null && !isValidReps(item.targetReps)) {
      throw new InvariantError(
        'Target reps must be a whole number from 1 to 999',
      )
    }
    if (
      item.restSec !== null &&
      (!Number.isInteger(item.restSec) || item.restSec < 0)
    ) {
      throw new InvariantError('Rest must be a whole number of seconds')
    }
  }
}

export async function createTemplate(input: TemplateInput): Promise<Template> {
  const now = Date.now()
  const template: Template = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: input.name.trim(),
    notes: input.notes ?? '',
    items: (input.items ?? []).map((item) => ({ ...item })),
  }
  validate(template)
  await db.templates.add(template)
  return template
}

export async function updateTemplate(
  id: Id,
  patch: Partial<TemplateInput>,
): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const current = requireLive(await db.templates.get(id), 'Template')
    const next: Template = {
      ...current,
      name: patch.name !== undefined ? patch.name.trim() : current.name,
      notes: patch.notes ?? current.notes,
      items: patch.items
        ? patch.items.map((item) => ({ ...item }))
        : current.items,
      updatedAt: Date.now(),
    }
    validate(next)
    await db.templates.put(next)
    return next
  })
}

export async function deleteTemplate(id: Id): Promise<void> {
  await db.transaction('rw', db.templates, async () => {
    const current = requireLive(await db.templates.get(id), 'Template')
    await db.templates.put(tombstone(current, Date.now()))
  })
}

export async function getTemplate(id: Id): Promise<Template | undefined> {
  return liveOrUndefined(await db.templates.get(id))
}

export async function listTemplates(): Promise<Template[]> {
  return db.templates.orderBy('name').filter(isLive).toArray()
}

/**
 * When each template was last used: the latest start of a workout that came
 * from it. Deleted workouts are not counted. Templates never used are absent.
 */
export async function listTemplateUsage(): Promise<Map<Id, EpochMs>> {
  const usage = new Map<Id, EpochMs>()
  await db.workouts
    .filter((w) => isLive(w) && w.templateId !== null)
    .each((w) => {
      const seen = usage.get(w.templateId!)
      if (seen === undefined || w.startedAt > seen) {
        usage.set(w.templateId!, w.startedAt)
      }
    })
  return usage
}

/**
 * Starts a workout from a template, in one transaction: the workout carries
 * the template's name and id, and each exercise follows in the template's
 * order with its target number of sets, unticked. A set takes its weight and
 * reps from the same position of the exercise's last session, then from the
 * set above it, and its reps from the target when neither has any. Exercises
 * that no longer exist are skipped. If a workout is already in progress it is
 * returned and nothing is added.
 *
 * The workout gets its own copy of everything, so editing or deleting the
 * template afterwards never changes it.
 */
export async function startWorkoutFromTemplate(
  id: Id,
  now: EpochMs = Date.now(),
): Promise<Workout> {
  return db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.sets, db.exercises, db.templates],
    async () => {
      const template = requireLive(await db.templates.get(id), 'Template')
      const existing = await getActiveWorkout()
      if (existing) return existing

      const workout = await startWorkout({
        title: template.name,
        templateId: template.id,
        now,
      })
      for (const item of template.items) {
        const exercise = await db.exercises.get(item.exerciseId)
        if (!exercise || !isLive(exercise)) continue
        const row = await addExerciseToWorkout(workout.id, item.exerciseId)
        const previous = await getPreviousPerformance(
          item.exerciseId,
          workout.id,
        )
        const current: SetValues[] = []
        for (let position = 0; position < item.targetSets; position++) {
          const fill = prefillForNewSet({ position, previous, current })
          const values = {
            weightKg: fill.weightKg,
            reps: fill.reps ?? item.targetReps,
          }
          await addSet(row.id, values)
          current.push(values)
        }
      }
      return workout
    },
  )
}

/**
 * Saves what was done in a workout as a new template: its exercises in order,
 * the number of sets completed, and the reps of the first working set.
 */
export async function createTemplateFromWorkout(
  workoutId: Id,
  name: string,
): Promise<Template> {
  return db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.sets, db.templates],
    async () => {
      requireLive(await db.workouts.get(workoutId), 'Workout')
      const items = itemsFromWorkout(
        await listWorkoutExercises(workoutId),
        await listWorkoutSets(workoutId),
      )
      if (items.length === 0) {
        throw new InvariantError('No set was completed in this workout')
      }
      return createTemplate({ name, items })
    },
  )
}
