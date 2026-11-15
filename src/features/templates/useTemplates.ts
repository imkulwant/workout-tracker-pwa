import { useLiveQuery } from 'dexie-react-hooks'
import { listExercises } from '../../data/repositories/exercises'
import {
  listTemplateUsage,
  listTemplates,
} from '../../data/repositories/templates'
import { getActiveWorkout } from '../../data/repositories/workouts'
import { sortByLastUsed } from '../../domain/templates'
import type { Exercise, Id } from '../../domain/types'

/** Templates by last use, with the exercises (archived too) and whether a workout is in progress. */
export function useTemplates() {
  return useLiveQuery(async () => {
    const [templates, usage, exercises, active] = await Promise.all([
      listTemplates(),
      listTemplateUsage(),
      listExercises({ includeArchived: true }),
      getActiveWorkout(),
    ])
    return {
      uses: sortByLastUsed(templates, usage),
      exercises: new Map<Id, Exercise>(exercises.map((e) => [e.id, e])),
      hasActiveWorkout: active !== undefined,
    }
  })
}
