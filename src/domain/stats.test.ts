import { describe, expect, it } from 'vitest'
import {
  BODY_MAP_LEVEL_STARTS,
  bodyMapLevel,
  calendarLevels,
  calendarValues,
  calendarWeeks,
  muscleDetails,
  muscleWeekMatrix,
  muscleWeeklyRates,
  rangeStart,
  weeklyVolume,
} from './heatmaps'
import {
  bodyPartSetCounts,
  estimatedOneRepMaxKg,
  roundE1rmKg,
  weeklyStreak,
} from './metrics'
import { progressSeries } from './progress'
import type { Exercise, SetType, WorkoutSet } from './types'

const exercises = new Map<
  string,
  Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>
>([
  [
    'bench',
    { primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front_delts'] },
  ],
  [
    'squat',
    { primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'] },
  ],
  [
    'row',
    { primaryMuscles: ['lats', 'upper_back'], secondaryMuscles: ['biceps'] },
  ],
  ['curl', { primaryMuscles: ['biceps'], secondaryMuscles: [] }],
])

interface Options {
  weightKg?: number | null
  reps?: number | null
  type?: SetType
  done?: boolean
  workoutId?: string
}
const set = (
  exerciseId: string,
  date: string,
  {
    weightKg = 100,
    reps = 5,
    type = 'working',
    done = true,
    workoutId,
  }: Options = {},
) =>
  ({
    exerciseId,
    date,
    weightKg,
    reps,
    type,
    completedAt: done ? 1 : null,
    workoutId: workoutId ?? `w-${date}`,
  }) as Pick<
    WorkoutSet,
    | 'exerciseId'
    | 'date'
    | 'weightKg'
    | 'reps'
    | 'type'
    | 'completedAt'
    | 'workoutId'
  >

describe('estimatedOneRepMaxKg', () => {
  it.each([
    [100, 1, 100],
    [100, 5, 100 * (1 + 5 / 30)],
    [80, 12, 112],
    [60, 2, 64],
    [80, 13, null],
    [80, 0, null],
    [0, 5, null],
    [null, 5, null],
    [80, null, null],
  ])('%s kg x %s reps is %s', (weightKg, reps, expected) => {
    const result = estimatedOneRepMaxKg({ weightKg, reps })
    if (expected === null) expect(result).toBeNull()
    else expect(result).toBeCloseTo(expected, 10)
  })

  it('rounds for display to the nearest 0.5 kg', () => {
    expect(roundE1rmKg(116.666)).toBe(116.5)
    expect(roundE1rmKg(116.75)).toBe(117)
    expect(roundE1rmKg(112.2)).toBe(112)
    expect(roundE1rmKg(112.3)).toBe(112.5)
  })
})

describe('bodyPartSetCounts', () => {
  it('counts a set once per part, at the strongest muscle in that part', () => {
    const counts = bodyPartSetCounts(
      [
        set('bench', '2026-11-02'),
        set('bench', '2026-11-02'),
        set('squat', '2026-11-02'),
        set('squat', '2026-11-02'),
        set('squat', '2026-11-02'),
        set('row', '2026-11-02'),
      ],
      exercises,
    )
    expect(counts).toEqual({
      chest: 2, // 2 sets x 1
      shoulders: 1, // front delts are secondary: 2 x 0.5
      arms: 1.5, // triceps 2 x 0.5, biceps 1 x 0.5
      legs: 3, // glutes and quads primary, hamstrings secondary: still 1 a set
      back: 1, // lats and upper back are both primary: 1, not 2
      core: 0,
    })
  })

  it('skips warm-ups and sets that were not ticked', () => {
    const counts = bodyPartSetCounts(
      [
        set('bench', '2026-11-02', { type: 'warmup' }),
        set('bench', '2026-11-02', { done: false }),
      ],
      exercises,
    )
    expect(counts.chest).toBe(0)
  })
})

describe('weeklyStreak', () => {
  // 2026-11-11 is a Wednesday, in the week starting Monday 2026-11-09.
  const today = '2026-11-11'

  it('counts consecutive weeks ending at the current one', () => {
    expect(
      weeklyStreak(
        ['2026-11-10', '2026-11-03', '2026-10-28', '2026-10-14'],
        today,
      ),
    ).toBe(3)
  })

  it('may end at the previous week when this week has no workout yet', () => {
    expect(weeklyStreak(['2026-11-03', '2026-10-28'], today)).toBe(2)
  })

  it('is broken by a week with nothing', () => {
    expect(weeklyStreak(['2026-10-28'], today)).toBe(0)
    expect(weeklyStreak([], today)).toBe(0)
  })

  it('counts several workouts in a week once, and a Sunday in its own week', () => {
    expect(
      weeklyStreak(['2026-11-09', '2026-11-11', '2026-11-08'], today),
    ).toBe(2)
  })

  it('works on a Monday and on a Sunday', () => {
    expect(weeklyStreak(['2026-11-09'], '2026-11-09')).toBe(1)
    expect(weeklyStreak(['2026-11-09'], '2026-11-15')).toBe(1)
    expect(weeklyStreak(['2026-11-09'], '2026-11-16')).toBe(1)
    expect(weeklyStreak(['2026-11-09'], '2026-11-23')).toBe(0)
  })
})

describe('calendarLevels', () => {
  const from = '2026-01-01'
  const to = '2026-01-31'
  const days = (values: number[]) =>
    new Map(
      values.map((v, i) => [`2026-01-${String(i + 1).padStart(2, '0')}`, v]),
    )
  const levels = (values: number[]) => [
    ...calendarLevels(days(values), from, to).values(),
  ]

  it('ranks eight days by nearest-rank percentiles', () => {
    // n = 8: the 25th, 50th and 75th percentiles are the 2nd, 4th and 6th values.
    expect(levels([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it('puts four distinct days in four levels', () => {
    expect(levels([10, 20, 30, 40])).toEqual([1, 2, 3, 4])
  })

  it('gives equal values the same level', () => {
    expect(levels([5, 5, 5, 5, 5])).toEqual([1, 1, 1, 1, 1])
  })

  it('makes every day level 2 with fewer than four non-zero days', () => {
    expect(levels([7])).toEqual([2])
    expect(levels([1, 100, 3])).toEqual([2, 2, 2])
  })

  it('leaves days with no value out, and ranks only the visible range', () => {
    const values = new Map([
      ['2025-12-31', 1000], // outside the range
      ['2026-01-02', 1],
      ['2026-01-03', 2],
      ['2026-01-04', 3],
      ['2026-01-05', 4],
    ])
    const result = calendarLevels(values, from, to)
    expect(result.has('2025-12-31')).toBe(false)
    expect(result.has('2026-01-01')).toBe(false)
    expect([...result.values()]).toEqual([1, 2, 3, 4])
  })

  it('ignores zero values', () => {
    expect(calendarLevels(new Map([['2026-01-02', 0]]), from, to).size).toBe(0)
  })
})

describe('calendarWeeks', () => {
  it('has 53 Monday-start weeks ending with the current one', () => {
    const weeks = calendarWeeks('2026-11-11')
    expect(weeks).toHaveLength(53)
    expect(weeks[0]!.weekStart).toBe('2025-11-10')
    expect(weeks[52]!.weekStart).toBe('2026-11-09')
    expect(weeks[52]!.days).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      null,
      null,
      null,
      null,
    ])
    expect(weeks[0]!.days.every((d) => d !== null)).toBe(true)
  })

  it('shows a whole week when today is Sunday', () => {
    expect(calendarWeeks('2026-11-15')[52]!.days.every((d) => d !== null)).toBe(
      true,
    )
  })
})

describe('calendarValues', () => {
  const workouts = new Map([
    ['w-a', { date: '2026-11-02', startedAt: 0, endedAt: 3_600_000 }],
    ['w-b', { date: '2026-11-03', startedAt: 0, endedAt: 1_800_000 }],
  ])
  const sets = [
    set('bench', '2026-11-02', { workoutId: 'w-a' }),
    set('bench', '2026-11-02', { workoutId: 'w-a', weightKg: 50, reps: 10 }),
    set('curl', '2026-11-02', { workoutId: 'w-a', weightKg: 20, reps: 10 }),
    set('bench', '2026-11-02', { workoutId: 'w-a', type: 'warmup' }),
    set('bench', '2026-11-02', { workoutId: 'w-a', done: false }),
    set('curl', '2026-11-03', { workoutId: 'w-b', weightKg: null, reps: 8 }),
  ]
  const run = (
    metric: 'sets' | 'volume' | 'duration',
    bodyPart: Parameters<typeof calendarValues>[0]['bodyPart'] = null,
  ) =>
    Object.fromEntries(
      calendarValues({ sets, workouts, exercises, metric, bodyPart }),
    )

  it('counts sets, leaving out warm-ups and unticked sets', () => {
    expect(run('sets')).toEqual({ '2026-11-02': 3, '2026-11-03': 1 })
  })

  it('adds volume, a missing weight counting as 0 so that day has none', () => {
    expect(run('volume')).toEqual({ '2026-11-02': 500 + 500 + 200 })
  })

  it('adds the time of each workout once, however many sets it has', () => {
    expect(run('duration')).toEqual({
      '2026-11-02': 3_600_000,
      '2026-11-03': 1_800_000,
    })
  })

  it('filters by the primary muscles of a body part', () => {
    expect(run('sets', 'chest')).toEqual({ '2026-11-02': 2 })
    expect(run('sets', 'arms')).toEqual({ '2026-11-02': 1, '2026-11-03': 1 })
    expect(run('sets', 'legs')).toEqual({})
    expect(run('duration', 'chest')).toEqual({ '2026-11-02': 3_600_000 })
  })
})

describe('bodyMapLevel', () => {
  it.each([
    [0, 0],
    [0.01, 1],
    [3.99, 1],
    [4, 2],
    [7.99, 2],
    [8, 3],
    [13.99, 3],
    [14, 4],
    [40, 4],
  ])('%d sets a week is level %d', (weekly, level) => {
    expect(bodyMapLevel(weekly)).toBe(level)
  })

  it('takes its thresholds from the named constants', () => {
    expect(BODY_MAP_LEVEL_STARTS).toEqual([4, 8, 14])
  })
})

describe('body map rates and details', () => {
  const today = '2026-11-11'
  const sets = [
    ...Array.from({ length: 7 }, () => set('bench', '2026-11-05')),
    set('bench', '2026-11-04'), // one day outside a 7-day range
    ...Array.from({ length: 3 }, () => set('curl', '2026-11-10')),
    set('row', '2026-11-10'),
    set('bench', '2026-11-05', { type: 'warmup' }),
  ]

  it('includes today and the six days before it in a 7-day range', () => {
    expect(rangeStart(today, 7)).toBe('2026-11-05')
    expect(rangeStart(today, 30)).toBe('2026-10-13')
  })

  it('divides muscle sets by the weeks in the range', () => {
    const week = muscleWeeklyRates(sets, exercises, today, 7)
    expect(week.get('chest')).toBe(7)
    expect(week.get('biceps')).toBe(3.5) // 3 curls + 1 row x 0.5
    expect(week.get('triceps')).toBe(3.5) // 7 bench sets x 0.5
    expect(week.get('calves')).toBe(0)
    expect(week.size).toBe(18)

    const month = muscleWeeklyRates(sets, exercises, today, 30)
    expect(month.get('chest')).toBeCloseTo(8 / (30 / 7), 10)
  })

  it('names the last trained date and the top exercises in the range', () => {
    const details = muscleDetails('biceps', sets, exercises, today, 7)
    expect(details.weeklyRate).toBe(3.5)
    expect(details.lastTrained).toBe('2026-11-10')
    expect(details.topExercises).toEqual([
      { exerciseId: 'curl', sets: 3 },
      { exerciseId: 'row', sets: 0.5 },
    ])
  })

  it('looks back past the range for the last trained date, and ignores the future', () => {
    const details = muscleDetails(
      'chest',
      [set('bench', '2026-08-01'), set('bench', '2026-12-01')],
      exercises,
      today,
      7,
    )
    expect(details.lastTrained).toBe('2026-08-01')
    expect(details.topExercises).toEqual([])
    expect(details.weeklyRate).toBe(0)
  })

  it('keeps at most three exercises, ties in id order', () => {
    const many = ['a', 'b', 'c', 'd'].map((id) => set(id, '2026-11-10'))
    const map = new Map(
      ['a', 'b', 'c', 'd'].map((id) => [
        id,
        { primaryMuscles: ['chest' as const], secondaryMuscles: [] },
      ]),
    )
    const details = muscleDetails('chest', many, map, today, 7)
    expect(details.topExercises.map((e) => e.exerciseId)).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})

describe('muscleWeekMatrix', () => {
  const today = '2026-11-11'
  const sets = [
    set('bench', '2026-11-10'),
    set('bench', '2026-11-09'), // Monday of this week
    set('bench', '2026-11-08'), // Sunday of the week before
    set('squat', '2026-08-24'), // Monday of the oldest column
    set('squat', '2026-08-23'), // the Sunday before it: outside
  ]
  const matrix = muscleWeekMatrix(sets, exercises, today)

  it('has 12 Monday-start columns ending with this week', () => {
    expect(matrix.weekStarts).toHaveLength(12)
    expect(matrix.weekStarts[0]).toBe('2026-08-24')
    expect(matrix.weekStarts[11]).toBe('2026-11-09')
  })

  it('has a row per body part with weekly body-part sets', () => {
    const row = (part: string) => matrix.rows.find((r) => r.part === part)!
    expect(matrix.rows.map((r) => r.part)).toEqual([
      'chest',
      'back',
      'shoulders',
      'arms',
      'legs',
      'core',
    ])
    expect(row('chest').cells.at(-1)).toBe(2)
    expect(row('chest').cells.at(-2)).toBe(1)
    expect(row('legs').cells[0]).toBe(1)
    expect(row('legs').cells.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('has the muscles of a part under it, with muscle sets', () => {
    const arms = matrix.rows.find((r) => r.part === 'arms')!
    expect(arms.muscles.map((m) => m.muscle)).toEqual([
      'biceps',
      'triceps',
      'forearms',
    ])
    expect(arms.muscles[1]!.cells.at(-1)).toBe(1) // 2 bench sets x 0.5
    expect(arms.cells.at(-1)).toBe(1)
  })
})

describe('weeklyVolume', () => {
  it('sums volume per calendar week for 12 weeks, oldest first', () => {
    const result = weeklyVolume(
      [
        set('bench', '2026-11-10'), // 500
        set('bench', '2026-11-09', { weightKg: 50, reps: 10 }), // 500
        set('bench', '2026-11-08'), // 500, the week before
        set('bench', '2026-11-08', { type: 'warmup' }),
        set('bench', '2026-08-20'), // before the first column
      ],
      '2026-11-11',
    )
    expect(result).toHaveLength(12)
    expect(result[0]!.weekStart).toBe('2026-08-24')
    expect(result[11]).toEqual({ weekStart: '2026-11-09', volumeKg: 1000 })
    expect(result[10]).toEqual({ weekStart: '2026-11-02', volumeKg: 500 })
    expect(result.slice(0, 10).every((w) => w.volumeKg === 0)).toBe(true)
  })
})

describe('progressSeries', () => {
  const today = '2026-11-11'
  const sets = [
    set('bench', '2026-11-02', { workoutId: 'a', weightKg: 100, reps: 5 }),
    set('bench', '2026-11-02', { workoutId: 'a', weightKg: 90, reps: 8 }),
    set('bench', '2026-11-09', { workoutId: 'b', weightKg: 110, reps: 1 }),
    set('bench', '2026-11-09', { workoutId: 'b', weightKg: 40, reps: 15 }),
    set('bench', '2026-08-01', { workoutId: 'c', weightKg: 80, reps: 10 }),
    set('bench', '2025-01-01', { workoutId: 'd', weightKg: 60, reps: 10 }),
    set('bench', '2026-11-09', {
      workoutId: 'b',
      weightKg: 200,
      reps: 1,
      type: 'warmup',
    }),
  ]

  it('gives the best estimated 1RM of each session', () => {
    const result = progressSeries(sets, 'e1rm', '6m', today)
    expect(result.map((p) => p.date)).toEqual([
      '2026-08-01',
      '2026-11-02',
      '2026-11-09',
    ])
    expect(result[0]!.value).toBeCloseTo(80 * (1 + 10 / 30), 10)
    // 90 x 8 gives 114, which is below 100 x 5 at 116.67.
    expect(result[1]!.value).toBeCloseTo(100 * (1 + 5 / 30), 10)
    expect(result[2]!.value).toBe(110)
  })

  it('gives the heaviest weight of each session', () => {
    expect(
      progressSeries(sets, 'weight', '6m', today).map((p) => p.value),
    ).toEqual([80, 100, 110])
  })

  it('gives the total volume of each session, warm-ups left out', () => {
    expect(
      progressSeries(sets, 'volume', '6m', today).map((p) => p.value),
    ).toEqual([800, 500 + 720, 110 + 600])
  })

  it('limits the range, today included, and "all" has no limit', () => {
    expect(progressSeries(sets, 'weight', '3m', today)).toHaveLength(2)
    expect(progressSeries(sets, 'weight', '6m', today)).toHaveLength(3)
    expect(progressSeries(sets, 'weight', '1y', today)).toHaveLength(3)
    expect(progressSeries(sets, 'weight', 'all', today)).toHaveLength(4)
  })

  it('starts a 3-month range 90 days before today, so 91 days are covered', () => {
    const edge = [
      set('bench', '2026-08-13', { workoutId: 'in' }), // 90 days before
      set('bench', '2026-08-12', { workoutId: 'out' }), // 91 days before
    ]
    expect(
      progressSeries(edge, 'weight', '3m', today).map((p) => p.date),
    ).toEqual(['2026-08-13'])
  })

  it('skips sessions with nothing to show for the measure', () => {
    const only15 = [set('bench', '2026-11-09', { workoutId: 'z', reps: 15 })]
    expect(progressSeries(only15, 'e1rm', 'all', today)).toEqual([])
    expect(progressSeries(only15, 'weight', 'all', today)).toHaveLength(1)
  })
})
