import { describe, expect, it } from 'vitest'
import { groupByWeek, summariseWorkout, type HistoryEntry } from './history'
import type { Workout, WorkoutSet } from './types'

const workout = (id: string, date: string, startedAt = 0): Workout =>
  ({
    id,
    date,
    startedAt,
    endedAt: startedAt + 1,
    status: 'completed',
  }) as Workout

const entry = (id: string, date: string, startedAt = 0): HistoryEntry => ({
  workout: workout(id, date, startedAt),
  setCount: 0,
  volumeKg: 0,
  bodyParts: [],
})

describe('groupByWeek', () => {
  it('starts a week on Monday, so Sunday ends the week before', () => {
    // 2026-11-08 is a Sunday and 2026-11-09 a Monday.
    const groups = groupByWeek([
      entry('mon', '2026-11-09'),
      entry('sun', '2026-11-08'),
    ])
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-11-09', '2026-11-02'])
    expect(groups[0]!.entries.map((e) => e.workout.id)).toEqual(['mon'])
    expect(groups[1]!.entries.map((e) => e.workout.id)).toEqual(['sun'])
  })

  it('puts the newest week and the newest day first', () => {
    const groups = groupByWeek([
      entry('a', '2026-11-03'),
      entry('b', '2026-11-12'),
      entry('c', '2026-11-05'),
      entry('d', '2026-11-10'),
    ])
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-11-09', '2026-11-02'])
    expect(groups[0]!.entries.map((e) => e.workout.id)).toEqual(['b', 'd'])
    expect(groups[1]!.entries.map((e) => e.workout.id)).toEqual(['c', 'a'])
  })

  it('orders two workouts on one day by start time, latest first', () => {
    const groups = groupByWeek([
      entry('early', '2026-11-10', 100),
      entry('late', '2026-11-10', 900),
    ])
    expect(groups[0]!.entries.map((e) => e.workout.id)).toEqual([
      'late',
      'early',
    ])
  })

  it('leaves out weeks with no workout and handles an empty list', () => {
    expect(groupByWeek([])).toEqual([])
    expect(
      groupByWeek([entry('a', '2026-11-30'), entry('b', '2026-11-02')]).length,
    ).toBe(2)
  })
})

describe('summariseWorkout', () => {
  const exercises = new Map([
    ['bench', { primaryMuscles: ['chest' as const] }],
    ['squat', { primaryMuscles: ['quads' as const, 'glutes' as const] }],
    ['curl', { primaryMuscles: ['biceps' as const] }],
  ])
  const set = (
    exerciseId: string,
    options: Partial<WorkoutSet> = {},
  ): WorkoutSet =>
    ({
      exerciseId,
      weightKg: 100,
      reps: 5,
      type: 'working',
      completedAt: 1,
      ...options,
    }) as WorkoutSet

  it('totals the sets and volume that count', () => {
    const result = summariseWorkout(
      workout('w', '2026-11-09'),
      [
        set('bench'),
        set('bench', { type: 'warmup' }),
        set('bench', { completedAt: null }),
      ],
      exercises,
    )
    expect(result.setCount).toBe(1)
    expect(result.volumeKg).toBe(500)
  })

  it('lists each body part once, in the plan order, from counted sets only', () => {
    const result = summariseWorkout(
      workout('w', '2026-11-09'),
      [
        set('curl'),
        set('squat'),
        set('squat'),
        set('bench'),
        set('curl', { completedAt: null }),
        set('bench', { type: 'warmup' }),
      ],
      exercises,
    )
    expect(result.bodyParts).toEqual(['chest', 'arms', 'legs'])
  })

  it('has no body parts when nothing counts', () => {
    expect(
      summariseWorkout(workout('w', '2026-11-09'), [], exercises).bodyParts,
    ).toEqual([])
  })
})
