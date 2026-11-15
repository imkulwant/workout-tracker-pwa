// Development and test only: nothing in the app imports this file, so it is
// not in the shipped bundle. It makes two years of believable training from a
// seed, so the Stats screens can be built, timed and photographed with data
// that does not change between runs.

import {
  addDays,
  startOfWeek,
  toLocalDate,
  weekdayIndex,
} from '../domain/dates.ts'
import type {
  Id,
  LocalDate,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../domain/types.ts'

export interface GeneratedTraining {
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: WorkoutSet[]
}

/** The id the app gives a seed exercise (see `seedId` in `data/seed.ts`). */
const idOf = (name: string): Id =>
  `seed-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`

interface Lift {
  name: string
  /** Starting working weight in kg; null for a bodyweight exercise. */
  startKg: number | null
  reps: [low: number, high: number]
  sets: number
  /** Kilograms gained per year of training. */
  yearlyGainKg: number
}

const PUSH: Lift[] = [
  {
    name: 'Barbell Bench Press',
    startKg: 70,
    reps: [5, 8],
    sets: 4,
    yearlyGainKg: 15,
  },
  {
    name: 'Overhead Press',
    startKg: 40,
    reps: [6, 10],
    sets: 3,
    yearlyGainKg: 7.5,
  },
  {
    name: 'Incline Dumbbell Press',
    startKg: 24,
    reps: [8, 12],
    sets: 3,
    yearlyGainKg: 5,
  },
  {
    name: 'Dumbbell Lateral Raise',
    startKg: 8,
    reps: [12, 15],
    sets: 3,
    yearlyGainKg: 2,
  },
  {
    name: 'Triceps Pushdown',
    startKg: 30,
    reps: [10, 14],
    sets: 3,
    yearlyGainKg: 5,
  },
]
const PULL: Lift[] = [
  {
    name: 'Barbell Row',
    startKg: 60,
    reps: [6, 10],
    sets: 4,
    yearlyGainKg: 12.5,
  },
  { name: 'Pull-Up', startKg: null, reps: [6, 10], sets: 3, yearlyGainKg: 0 },
  {
    name: 'Seated Cable Row',
    startKg: 50,
    reps: [8, 12],
    sets: 3,
    yearlyGainKg: 7.5,
  },
  { name: 'Face Pull', startKg: 20, reps: [12, 15], sets: 3, yearlyGainKg: 4 },
  {
    name: 'Barbell Curl',
    startKg: 30,
    reps: [8, 12],
    sets: 3,
    yearlyGainKg: 5,
  },
]
const LEGS: Lift[] = [
  { name: 'Back Squat', startKg: 90, reps: [5, 8], sets: 4, yearlyGainKg: 20 },
  {
    name: 'Romanian Deadlift',
    startKg: 80,
    reps: [6, 10],
    sets: 3,
    yearlyGainKg: 15,
  },
  { name: 'Leg Press', startKg: 160, reps: [8, 12], sets: 3, yearlyGainKg: 30 },
  {
    name: 'Lying Leg Curl',
    startKg: 40,
    reps: [10, 14],
    sets: 3,
    yearlyGainKg: 5,
  },
  {
    name: 'Standing Calf Raise',
    startKg: 60,
    reps: [10, 15],
    sets: 4,
    yearlyGainKg: 10,
  },
]
const UPPER: Lift[] = [
  {
    name: 'Dumbbell Bench Press',
    startKg: 30,
    reps: [8, 12],
    sets: 3,
    yearlyGainKg: 5,
  },
  {
    name: 'Lat Pulldown',
    startKg: 55,
    reps: [8, 12],
    sets: 3,
    yearlyGainKg: 7.5,
  },
  {
    name: 'Hammer Curl',
    startKg: 14,
    reps: [10, 12],
    sets: 3,
    yearlyGainKg: 2,
  },
  {
    name: 'Cable Crunch',
    startKg: 40,
    reps: [12, 15],
    sets: 3,
    yearlyGainKg: 5,
  },
]

/** Monday is 0. A day number maps to the session done on it, if any. */
const WEEK_PLAN: Partial<Record<number, Lift[]>> = {
  0: PUSH,
  1: PULL,
  3: LEGS,
  5: UPPER,
}

/** A small, fast, repeatable random number generator (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step

export interface GenerateOptions {
  /** The last day that may hold a workout. */
  endDate: LocalDate
  years?: number
  seed?: number
  /** Chance that a planned session is skipped. */
  skipChance?: number
  /** Chance that a whole week is skipped, like a holiday. */
  holidayChance?: number
}

export function generateTraining(options: GenerateOptions): GeneratedTraining {
  const {
    endDate,
    years = 2,
    seed = 1,
    skipChance = 0.15,
    holidayChance = 0.06,
  } = options
  const random = createRandom(seed)
  const pick = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1))

  const result: GeneratedTraining = {
    workouts: [],
    workoutExercises: [],
    sets: [],
  }
  const firstDate = addDays(endDate, -365 * years)
  const holidayWeeks = new Set<LocalDate>()
  let n = 0

  for (let date = firstDate; date <= endDate; date = addDays(date, 1)) {
    const week = startOfWeek(date)
    // A holiday week is decided once, on the first day we reach the week.
    if (
      (date === firstDate || weekdayIndex(date) === 0) &&
      random() < holidayChance
    ) {
      holidayWeeks.add(week)
    }
    const plan = WEEK_PLAN[weekdayIndex(date)]
    if (!plan || holidayWeeks.has(week) || random() < skipChance) continue

    const [year, month, day] = date.split('-').map(Number) as [
      number,
      number,
      number,
    ]
    const startedAt = new Date(
      year,
      month - 1,
      day,
      17 + pick(0, 2),
      pick(0, 5) * 10,
    ).getTime()
    const endedAt = startedAt + pick(48, 85) * 60_000
    const workoutId = `gen-w-${n}`
    const entity = { createdAt: startedAt, updatedAt: endedAt, deletedAt: null }
    result.workouts.push({
      ...entity,
      id: workoutId,
      date: toLocalDate(startedAt),
      startedAt,
      endedAt,
      status: 'completed',
      title: '',
      notes: '',
      templateId: null,
    })

    const yearsTrained =
      (startedAt - new Date(firstDate).getTime()) / (365 * 86_400_000)
    plan.forEach((lift, position) => {
      const rowId = `gen-we-${n}-${position}`
      result.workoutExercises.push({
        ...entity,
        id: rowId,
        workoutId,
        exerciseId: idOf(lift.name),
        position,
        notes: '',
      })
      const working =
        lift.startKg === null
          ? null
          : roundTo(lift.startKg + lift.yearlyGainKg * yearsTrained, 2.5)
      const push = (
        type: WorkoutSet['type'],
        weightKg: number | null,
        reps: number,
        index: number,
      ) =>
        result.sets.push({
          ...entity,
          id: `gen-s-${n}-${position}-${index}`,
          workoutId,
          workoutExerciseId: rowId,
          exerciseId: idOf(lift.name),
          date: toLocalDate(startedAt),
          position: index,
          type,
          weightKg,
          reps,
          completedAt: startedAt + (position * 12 + index * 3 + 5) * 60_000,
        })
      let index = 0
      if (position === 0 && working !== null) {
        push('warmup', roundTo(working * 0.6, 2.5), 8, index++)
      }
      for (let setNumber = 0; setNumber < lift.sets; setNumber++) {
        // Reps drift down a little across the sets, as they do when you train hard.
        const reps = Math.max(
          lift.reps[0],
          pick(lift.reps[0], lift.reps[1]) - setNumber,
        )
        push('working', working, reps, index++)
      }
    })
    n++
  }
  return result
}
