import { describe, expect, it } from 'vitest'
import { seedId, SEED_EXERCISES } from '../data/seed'
import { buildBackup } from '../data/backup/export'
import { parseBackup } from '../data/backup/schema'
import { db } from '../data/db'
import { resetDb } from '../test/db'
import { createRandom, generateTraining } from './generateTraining'

const options = { endDate: '2026-11-11', seed: 7 }

describe('generateTraining', () => {
  const data = generateTraining(options)

  it('is the same every time for the same seed, and differs for another', () => {
    expect(generateTraining(options)).toEqual(data)
    expect(generateTraining({ ...options, seed: 8 })).not.toEqual(data)
  })

  it('makes about two years of training: a few hundred workouts, thousands of sets', () => {
    expect(data.workouts.length).toBeGreaterThan(250)
    expect(data.workouts.length).toBeLessThan(420)
    expect(data.sets.length).toBeGreaterThan(4000)
    const dates = data.workouts.map((w) => w.date).sort()
    expect(dates[0]! >= '2024-11-12').toBe(true)
    expect(dates.at(-1)! <= '2026-11-11').toBe(true)
  })

  it('only uses exercises that exist in the seed library', () => {
    const known = new Set(SEED_EXERCISES.map((e) => seedId(e.name)))
    for (const row of data.workoutExercises)
      expect(known.has(row.exerciseId)).toBe(true)
  })

  it('keeps every row consistent: dates, references, ticks and positions', () => {
    const workouts = new Map(data.workouts.map((w) => [w.id, w]))
    const rows = new Map(data.workoutExercises.map((r) => [r.id, r]))
    for (const set of data.sets) {
      expect(set.date).toBe(workouts.get(set.workoutId)!.date)
      expect(rows.get(set.workoutExerciseId)!.exerciseId).toBe(set.exerciseId)
      expect(set.completedAt).not.toBeNull()
      expect(set.reps).toBeGreaterThanOrEqual(1)
    }
    for (const workout of data.workouts) {
      expect(workout.endedAt!).toBeGreaterThan(workout.startedAt)
    }
    const ids = [...data.workouts, ...data.workoutExercises, ...data.sets].map(
      (r) => r.id,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gets heavier over the two years', () => {
    const bench = data.sets.filter(
      (s) =>
        s.exerciseId === 'seed-barbell-bench-press' && s.type === 'working',
    )
    const early = bench.slice(0, 20).map((s) => s.weightKg!)
    const late = bench.slice(-20).map((s) => s.weightKg!)
    expect(Math.min(...late)).toBeGreaterThan(Math.max(...early))
  })

  it('is a valid backup once the seed exercises are in', async () => {
    await resetDb()
    const now = Date.now()
    await db.exercises.bulkPut(
      SEED_EXERCISES.map((seed) => ({
        id: seedId(seed.name),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: seed.name,
        nameKey: seed.name.toLowerCase(),
        equipment: seed.equipment,
        loadType: seed.loadType,
        primaryMuscles: [...seed.primaryMuscles],
        secondaryMuscles: [...seed.secondaryMuscles],
        isCustom: false,
        notes: '',
        defaultRestSec: null,
        incrementKg: 2.5,
        archivedAt: null,
      })),
    )
    await db.workouts.bulkPut(data.workouts)
    await db.workoutExercises.bulkPut(data.workoutExercises)
    await db.sets.bulkPut(data.sets)

    const text = JSON.stringify(await buildBackup('1.0.0'))
    const parsed = parseBackup(text)
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
  })
})

describe('createRandom', () => {
  it('gives numbers in [0, 1) that repeat for a seed', () => {
    const a = createRandom(3)
    const b = createRandom(3)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      expect(b()).toBe(x)
    }
  })
})
