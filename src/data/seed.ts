import { toNameKey } from '../domain/exercises'
import type {
  Equipment,
  Exercise,
  Id,
  LoadType,
  MuscleId,
} from '../domain/types'
import { db } from './db'

/** Bump when seed exercises are added; existing rows are never overwritten. */
export const SEED_VERSION = 1
const SEED_VERSION_KEY = 'seedVersion'
const DEFAULT_INCREMENT_KG = 2.5

export interface SeedExercise {
  name: string
  equipment: Equipment
  loadType: LoadType
  primaryMuscles: MuscleId[]
  secondaryMuscles: MuscleId[]
}

type Row = [
  name: string,
  equipment: Equipment,
  loadType: LoadType,
  primary: MuscleId[],
  secondary: MuscleId[],
]

const W = 'weight_reps'
const BW = 'bodyweight_reps'

// The muscle mappings drive every heatmap. This is the plan's "Seed exercise
// library" table, and seed.test.ts compares it with docs/PLAN.md row by row.
const ROWS: readonly Row[] = [
  ['Barbell Bench Press', 'barbell', W, ['chest'], ['front_delts', 'triceps']],
  [
    'Incline Barbell Bench Press',
    'barbell',
    W,
    ['chest'],
    ['front_delts', 'triceps'],
  ],
  [
    'Dumbbell Bench Press',
    'dumbbell',
    W,
    ['chest'],
    ['front_delts', 'triceps'],
  ],
  [
    'Incline Dumbbell Press',
    'dumbbell',
    W,
    ['chest'],
    ['front_delts', 'triceps'],
  ],
  ['Machine Chest Press', 'machine', W, ['chest'], ['front_delts', 'triceps']],
  ['Cable Fly', 'cable', W, ['chest'], ['front_delts']],
  ['Pec Deck', 'machine', W, ['chest'], ['front_delts']],
  ['Push-Up', 'bodyweight', BW, ['chest'], ['front_delts', 'triceps', 'abs']],
  ['Dip', 'bodyweight', BW, ['chest', 'triceps'], ['front_delts']],
  ['Pull-Up', 'bodyweight', BW, ['lats'], ['biceps', 'upper_back']],
  ['Chin-Up', 'bodyweight', BW, ['lats', 'biceps'], ['upper_back']],
  ['Lat Pulldown', 'cable', W, ['lats'], ['biceps', 'upper_back']],
  [
    'Barbell Row',
    'barbell',
    W,
    ['upper_back', 'lats'],
    ['biceps', 'rear_delts', 'lower_back'],
  ],
  [
    'Dumbbell Row',
    'dumbbell',
    W,
    ['lats', 'upper_back'],
    ['biceps', 'rear_delts'],
  ],
  [
    'Seated Cable Row',
    'cable',
    W,
    ['upper_back', 'lats'],
    ['biceps', 'rear_delts'],
  ],
  ['T-Bar Row', 'machine', W, ['upper_back', 'lats'], ['biceps', 'rear_delts']],
  [
    'Deadlift',
    'barbell',
    W,
    ['glutes', 'hamstrings', 'lower_back'],
    ['traps', 'lats', 'quads', 'forearms'],
  ],
  [
    'Romanian Deadlift',
    'barbell',
    W,
    ['hamstrings', 'glutes'],
    ['lower_back', 'forearms'],
  ],
  [
    'Back Extension',
    'bodyweight',
    BW,
    ['lower_back'],
    ['glutes', 'hamstrings'],
  ],
  ['Barbell Shrug', 'barbell', W, ['traps'], ['forearms']],
  ['Overhead Press', 'barbell', W, ['front_delts'], ['side_delts', 'triceps']],
  [
    'Seated Dumbbell Press',
    'dumbbell',
    W,
    ['front_delts'],
    ['side_delts', 'triceps'],
  ],
  [
    'Machine Shoulder Press',
    'machine',
    W,
    ['front_delts'],
    ['side_delts', 'triceps'],
  ],
  ['Dumbbell Lateral Raise', 'dumbbell', W, ['side_delts'], ['traps']],
  ['Cable Lateral Raise', 'cable', W, ['side_delts'], ['traps']],
  ['Reverse Pec Deck', 'machine', W, ['rear_delts'], ['upper_back']],
  ['Face Pull', 'cable', W, ['rear_delts'], ['upper_back', 'traps']],
  ['Barbell Curl', 'barbell', W, ['biceps'], ['forearms']],
  ['Dumbbell Curl', 'dumbbell', W, ['biceps'], ['forearms']],
  ['Hammer Curl', 'dumbbell', W, ['biceps', 'forearms'], []],
  ['Cable Curl', 'cable', W, ['biceps'], ['forearms']],
  ['Triceps Pushdown', 'cable', W, ['triceps'], []],
  ['Overhead Triceps Extension', 'cable', W, ['triceps'], []],
  ['Skull Crusher', 'barbell', W, ['triceps'], []],
  [
    'Back Squat',
    'barbell',
    W,
    ['quads', 'glutes'],
    ['adductors', 'lower_back', 'abs'],
  ],
  ['Front Squat', 'barbell', W, ['quads'], ['glutes', 'abs', 'upper_back']],
  ['Leg Press', 'machine', W, ['quads', 'glutes'], ['adductors', 'hamstrings']],
  [
    'Bulgarian Split Squat',
    'dumbbell',
    W,
    ['quads', 'glutes'],
    ['adductors', 'hamstrings'],
  ],
  [
    'Walking Lunge',
    'dumbbell',
    W,
    ['quads', 'glutes'],
    ['adductors', 'hamstrings'],
  ],
  ['Leg Extension', 'machine', W, ['quads'], []],
  ['Lying Leg Curl', 'machine', W, ['hamstrings'], ['calves']],
  ['Hip Thrust', 'barbell', W, ['glutes'], ['hamstrings']],
  ['Standing Calf Raise', 'machine', W, ['calves'], []],
  ['Hanging Leg Raise', 'bodyweight', BW, ['abs'], ['obliques']],
  ['Cable Crunch', 'cable', W, ['abs'], ['obliques']],
  ['Russian Twist', 'bodyweight', BW, ['obliques'], ['abs']],
]

export const SEED_EXERCISES: readonly SeedExercise[] = ROWS.map(
  ([name, equipment, loadType, primaryMuscles, secondaryMuscles]) => ({
    name,
    equipment,
    loadType,
    primaryMuscles,
    secondaryMuscles,
  }),
)

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Deterministic, so backups from before a reinstall merge cleanly. */
export function seedId(name: string): Id {
  return `seed-${slugify(name)}`
}

/**
 * Adds the seed library once, tracked by the `seedVersion` setting. Rows that
 * already exist, including ones you edited, archived or deleted, are left as
 * they are. Returns true when it wrote anything.
 */
export async function seedIfNeeded(): Promise<boolean> {
  return db.transaction('rw', db.exercises, db.settings, async () => {
    const stored = await db.settings.get(SEED_VERSION_KEY)
    if (typeof stored?.value === 'number' && stored.value >= SEED_VERSION) {
      return false
    }

    const now = Date.now()
    const existing = await db.exercises.bulkGet(
      SEED_EXERCISES.map((seed) => seedId(seed.name)),
    )
    const missing: Exercise[] = SEED_EXERCISES.flatMap((seed, i) =>
      existing[i]
        ? []
        : [
            {
              id: seedId(seed.name),
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              name: seed.name,
              nameKey: toNameKey(seed.name),
              equipment: seed.equipment,
              loadType: seed.loadType,
              primaryMuscles: [...seed.primaryMuscles],
              secondaryMuscles: [...seed.secondaryMuscles],
              isCustom: false,
              notes: '',
              defaultRestSec: null,
              incrementKg: DEFAULT_INCREMENT_KG,
              archivedAt: null,
            },
          ],
    )
    await db.exercises.bulkAdd(missing)
    await db.settings.put({
      key: SEED_VERSION_KEY,
      value: SEED_VERSION,
      updatedAt: now,
    })
    return true
  })
}
