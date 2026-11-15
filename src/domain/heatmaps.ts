import { addDays, eachDate, startOfWeek } from './dates'
import {
  bodyPartSetCounts,
  isMetricSet,
  muscleSetCounts,
  setVolumeKg,
  totalVolumeKg,
  workoutDurationMs,
} from './metrics'
import { BODY_PARTS, BODY_PART_MUSCLES, MUSCLE_IDS } from './muscles'
import type {
  BodyPart,
  Exercise,
  Id,
  LocalDate,
  MuscleId,
  Workout,
  WorkoutSet,
} from './types'

// Every threshold of the three heatmaps and the charts is a named constant
// here, so it can be tuned without touching a component.

/** The calendar covers this many calendar weeks, ending with the current one. */
export const CALENDAR_WEEKS = 53
/** Non-zero days are ranked at these percentiles into levels 1 to 4. */
export const CALENDAR_PERCENTILES = [0.25, 0.5, 0.75] as const
/** With fewer non-zero days than this, ranking means nothing. */
export const CALENDAR_MIN_DAYS_FOR_PERCENTILES = 4
/** The level every non-zero day gets when there are too few to rank. */
export const CALENDAR_FEW_DAYS_LEVEL = 2

/** The body map's ranges, in days, today included. */
export const BODY_MAP_RANGES = [7, 30, 90] as const
/** Weekly sets at which levels 2, 3 and 4 begin. Below the first is level 1. */
export const BODY_MAP_LEVEL_STARTS = [4, 8, 14] as const

export const MATRIX_WEEKS = 12
export const VOLUME_WEEKS = 12
/** How many exercises the body map names for a muscle. */
export const BODY_MAP_TOP_EXERCISES = 3

export type Level = 0 | 1 | 2 | 3 | 4

type SetLike = Pick<WorkoutSet, 'exerciseId' | 'completedAt' | 'type' | 'date'>
type ExerciseLike = Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>
type ExerciseMap = ReadonlyMap<Id, ExerciseLike>

// ---------------------------------------------------------------- calendar

export type CalendarMetric = 'sets' | 'volume' | 'duration'

/** Whether a set counts under a body-part filter: a primary muscle is in the part. */
function inBodyPart(
  set: Pick<WorkoutSet, 'exerciseId'>,
  exercises: ExerciseMap,
  part: BodyPart | null,
): boolean {
  if (part === null) return true
  const exercise = exercises.get(set.exerciseId)
  return (
    exercise?.primaryMuscles.some((m) => BODY_PART_MUSCLES[part].includes(m)) ??
    false
  )
}

/**
 * One value per date that has any: sets, volume in kg, or workout time in ms.
 * A body-part filter keeps only sets whose primary muscles include that part,
 * and for duration only workouts that have such a set. Dates with no value are
 * left out.
 */
export function calendarValues(input: {
  sets: readonly (SetLike &
    Pick<WorkoutSet, 'workoutId' | 'weightKg' | 'reps'>)[]
  workouts: ReadonlyMap<Id, Pick<Workout, 'date' | 'startedAt' | 'endedAt'>>
  exercises: ExerciseMap
  metric: CalendarMetric
  bodyPart: BodyPart | null
}): Map<LocalDate, number> {
  const { sets, workouts, exercises, metric, bodyPart } = input
  const values = new Map<LocalDate, number>()
  const add = (date: LocalDate, amount: number) =>
    values.set(date, (values.get(date) ?? 0) + amount)

  const counted = sets.filter(
    (set) => isMetricSet(set) && inBodyPart(set, exercises, bodyPart),
  )
  if (metric === 'sets') for (const set of counted) add(set.date, 1)
  else if (metric === 'volume') {
    for (const set of counted) add(set.date, setVolumeKg(set))
  } else {
    for (const id of new Set(counted.map((set) => set.workoutId))) {
      const workout = workouts.get(id)
      if (workout) add(workout.date, workoutDurationMs(workout))
    }
  }
  for (const [date, value] of values) if (value <= 0) values.delete(date)
  return values
}

/** The value at `fraction` of the sorted list, by nearest rank. */
function percentile(sorted: readonly number[], fraction: number): number {
  const rank = Math.max(1, Math.ceil(fraction * sorted.length))
  return sorted[rank - 1]!
}

/**
 * Levels for the dates from `from` to `to`. Level 0 is no value. Non-zero
 * days are ranked against each other: up to the 25th percentile is level 1,
 * up to the 50th level 2, up to the 75th level 3, above that level 4. With
 * fewer than four non-zero days they are all level 2.
 */
export function calendarLevels(
  values: ReadonlyMap<LocalDate, number>,
  from: LocalDate,
  to: LocalDate,
): Map<LocalDate, Level> {
  const visible = eachDate(from, to).flatMap((date): [LocalDate, number][] => {
    const value = values.get(date)
    return value !== undefined && value > 0 ? [[date, value]] : []
  })
  const sorted = visible.map(([, value]) => value).sort((a, b) => a - b)
  const levels = new Map<LocalDate, Level>()
  if (sorted.length < CALENDAR_MIN_DAYS_FOR_PERCENTILES) {
    for (const [date] of visible) levels.set(date, CALENDAR_FEW_DAYS_LEVEL)
    return levels
  }
  const [p1, p2, p3] = CALENDAR_PERCENTILES.map((f) =>
    percentile(sorted, f),
  ) as [number, number, number]
  for (const [date, value] of visible) {
    levels.set(date, value <= p1 ? 1 : value <= p2 ? 2 : value <= p3 ? 3 : 4)
  }
  return levels
}

export interface CalendarWeek {
  weekStart: LocalDate
  /** Monday to Sunday. Days after today are null. */
  days: (LocalDate | null)[]
}

/** The columns of the calendar, oldest first, the last one holding today. */
export function calendarWeeks(
  today: LocalDate,
  weeks: number = CALENDAR_WEEKS,
): CalendarWeek[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(first, 7 * i)
    return {
      weekStart,
      days: Array.from({ length: 7 }, (_, d) => {
        const date = addDays(weekStart, d)
        return date > today ? null : date
      }),
    }
  })
}

// ---------------------------------------------------------------- body map

/** 0 for no sets, then 1 below 4 a week, 2 from 4, 3 from 8, 4 from 14. */
export function bodyMapLevel(weeklySets: number): Level {
  if (weeklySets <= 0) return 0
  const [two, three, four] = BODY_MAP_LEVEL_STARTS
  if (weeklySets < two) return 1
  if (weeklySets < three) return 2
  if (weeklySets < four) return 3
  return 4
}

/** The first date of a range of `rangeDays` days that includes today. */
export const rangeStart = (today: LocalDate, rangeDays: number): LocalDate =>
  addDays(today, -(rangeDays - 1))

function inRange<T extends { date: LocalDate }>(
  sets: readonly T[],
  today: LocalDate,
  rangeDays: number,
): T[] {
  const from = rangeStart(today, rangeDays)
  return sets.filter((set) => set.date >= from && set.date <= today)
}

/** Sets per week for every muscle: its muscle sets over the range divided by `rangeDays / 7`. */
export function muscleWeeklyRates(
  sets: readonly SetLike[],
  exercises: ExerciseMap,
  today: LocalDate,
  rangeDays: number,
): Map<MuscleId, number> {
  const totals = new Map(
    muscleSetCounts(inRange(sets, today, rangeDays), exercises),
  )
  const weeks = rangeDays / 7
  return new Map(
    MUSCLE_IDS.map((muscle) => [muscle, (totals.get(muscle) ?? 0) / weeks]),
  )
}

export interface MuscleDetails {
  muscle: MuscleId
  weeklyRate: number
  /** The latest date, up to today and in any range, with a set that worked it. */
  lastTrained: LocalDate | null
  /** Exercises that worked it in the range, most muscle sets first. */
  topExercises: { exerciseId: Id; sets: number }[]
}

/** What the body map shows when a muscle is tapped. */
export function muscleDetails(
  muscle: MuscleId,
  sets: readonly SetLike[],
  exercises: ExerciseMap,
  today: LocalDate,
  rangeDays: number,
): MuscleDetails {
  const contribution = (set: SetLike): number => {
    const exercise = exercises.get(set.exerciseId)
    if (!exercise) return 0
    if (exercise.primaryMuscles.includes(muscle)) return 1
    return exercise.secondaryMuscles.includes(muscle) ? 0.5 : 0
  }
  const worked = sets.filter(
    (set) => isMetricSet(set) && set.date <= today && contribution(set) > 0,
  )
  const lastTrained = worked.reduce<LocalDate | null>(
    (latest, set) => (latest === null || set.date > latest ? set.date : latest),
    null,
  )
  const perExercise = new Map<Id, number>()
  for (const set of inRange(worked, today, rangeDays)) {
    perExercise.set(
      set.exerciseId,
      (perExercise.get(set.exerciseId) ?? 0) + contribution(set),
    )
  }
  const topExercises = [...perExercise]
    .map(([exerciseId, count]) => ({ exerciseId, sets: count }))
    .sort((a, b) => b.sets - a.sets || a.exerciseId.localeCompare(b.exerciseId))
    .slice(0, BODY_MAP_TOP_EXERCISES)
  const total = [...perExercise.values()].reduce((sum, n) => sum + n, 0)
  return {
    muscle,
    weeklyRate: total / (rangeDays / 7),
    lastTrained,
    topExercises,
  }
}

// ------------------------------------------------------------------ matrix

export interface MatrixPart {
  part: BodyPart
  /** Body-part sets in each week, oldest first. */
  cells: number[]
  muscles: { muscle: MuscleId; cells: number[] }[]
}

export interface WeekMatrix {
  weekStarts: LocalDate[]
  rows: MatrixPart[]
}

/**
 * Sets per week for each body part and, under it, each of its muscles, for the
 * last `weeks` calendar weeks. A cell's level is `bodyMapLevel` of its value.
 */
export function muscleWeekMatrix(
  sets: readonly SetLike[],
  exercises: ExerciseMap,
  today: LocalDate,
  weeks: number = MATRIX_WEEKS,
): WeekMatrix {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  const weekStarts = Array.from({ length: weeks }, (_, i) =>
    addDays(first, 7 * i),
  )
  const perWeek = weekStarts.map((weekStart) => {
    const end = addDays(weekStart, 6)
    const inWeek = sets.filter((s) => s.date >= weekStart && s.date <= end)
    return {
      muscles: new Map(muscleSetCounts(inWeek, exercises)),
      parts: bodyPartSetCounts(inWeek, exercises),
    }
  })
  return {
    weekStarts,
    rows: BODY_PARTS.map((part) => ({
      part,
      cells: perWeek.map((week) => week.parts[part]),
      muscles: BODY_PART_MUSCLES[part].map((muscle) => ({
        muscle,
        cells: perWeek.map((week) => week.muscles.get(muscle) ?? 0),
      })),
    })),
  }
}

// ------------------------------------------------------------------ charts

export interface WeekVolume {
  weekStart: LocalDate
  volumeKg: number
}

/** Volume per calendar week for the last `weeks` weeks, oldest first. */
export function weeklyVolume(
  sets: readonly (SetLike & Pick<WorkoutSet, 'weightKg' | 'reps'>)[],
  today: LocalDate,
  weeks: number = VOLUME_WEEKS,
): WeekVolume[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(first, 7 * i)
    const end = addDays(weekStart, 6)
    return {
      weekStart,
      volumeKg: totalVolumeKg(
        sets.filter((s) => s.date >= weekStart && s.date <= end),
      ),
    }
  })
}
