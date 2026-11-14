export type Id = string // crypto.randomUUID()
export type LocalDate = string // YYYY-MM-DD in the device's local time zone
export type EpochMs = number

export interface Entity {
  id: Id
  createdAt: EpochMs
  updatedAt: EpochMs
  deletedAt: EpochMs | null
}

export type MuscleId =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lats'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves'

export type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other'

export type LoadType = 'weight_reps' | 'bodyweight_reps'
export type SetType = 'working' | 'warmup' | 'drop' | 'failure'

export interface Exercise extends Entity {
  name: string
  nameKey: string // lower-case, trimmed, for search and uniqueness
  equipment: Equipment
  loadType: LoadType
  primaryMuscles: MuscleId[] // at least one
  secondaryMuscles: MuscleId[]
  isCustom: boolean
  notes: string
  defaultRestSec: number | null
  incrementKg: number // default 2.5
  archivedAt: EpochMs | null
}

export interface Workout extends Entity {
  date: LocalDate // local date of startedAt
  startedAt: EpochMs
  endedAt: EpochMs | null
  status: 'active' | 'completed'
  title: string
  notes: string
  templateId: Id | null
}

export interface WorkoutExercise extends Entity {
  workoutId: Id
  exerciseId: Id
  position: number
  notes: string
}

export interface WorkoutSet extends Entity {
  workoutId: Id
  workoutExerciseId: Id
  exerciseId: Id // denormalised
  date: LocalDate // denormalised from Workout.date
  position: number
  type: SetType
  weightKg: number | null // added load for bodyweight exercises
  reps: number | null
  completedAt: EpochMs | null // null until ticked
}

export interface TemplateItem {
  exerciseId: Id
  targetSets: number
  targetReps: number | null
  restSec: number | null
}

export interface Template extends Entity {
  name: string
  notes: string
  items: TemplateItem[]
}

export interface Setting {
  key: string
  value: unknown
  updatedAt: EpochMs
}
