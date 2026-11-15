import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  Setting,
  Template,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../domain/types'

// The name of the database inside the browser. It is not shown anywhere. It
// keeps the app's original name on purpose: renaming it would make every
// existing install open a new, empty database and orphan the old one.
export const DB_NAME = 'gym-tracker'

export class WorkoutDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  templates!: EntityTable<Template, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      exercises: 'id, nameKey, updatedAt',
      workouts: 'id, date, status, startedAt, updatedAt',
      workoutExercises: 'id, workoutId, exerciseId, updatedAt',
      sets: 'id, workoutId, workoutExerciseId, exerciseId, date, [exerciseId+date], updatedAt',
      templates: 'id, name, updatedAt',
      settings: 'key',
    })
  }
}

// UI code never imports this directly: it goes through src/data/repositories.
export const db = new WorkoutDb()
