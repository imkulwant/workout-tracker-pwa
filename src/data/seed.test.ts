import { beforeEach, describe, expect, it } from 'vitest'
import plan from '../../docs/PLAN.md?raw'
import { findMuscleProblem, toNameKey } from '../domain/exercises'
import { resetDb } from '../test/db'
import { db } from './db'
import {
  SEED_EXERCISES,
  SEED_VERSION,
  seedId,
  seedIfNeeded,
  slugify,
} from './seed'

interface PlanRow {
  name: string
  equipment: string
  loadType: string
  primary: string[]
  secondary: string[]
}

// The plan's table is the specification (operating rule 5), so the test reads
// it from docs/PLAN.md instead of trusting a second hand-typed copy.
function parsePlanSeedTable(): PlanRow[] {
  const section = plan.split('## Seed exercise library')[1]?.split('\n## ')[0]
  if (!section) throw new Error('Seed exercise library section not found')
  const muscles = (cell: string) =>
    cell === '' ? [] : cell.split(',').map((m) => m.trim())
  return section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2) // header and separator
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll('\\_', '_'))
      const [
        name = '',
        equipment = '',
        loadType = '',
        primary = '',
        secondary = '',
      ] = cells
      return {
        name,
        equipment,
        loadType,
        primary: muscles(primary),
        secondary: muscles(secondary),
      }
    })
}

describe('seed data', () => {
  it('has the 46 exercises of the plan, in the plan order', () => {
    const rows = parsePlanSeedTable()
    expect(rows).toHaveLength(46)
    expect(SEED_EXERCISES.map((e) => e.name)).toEqual(rows.map((r) => r.name))
  })

  it.each(parsePlanSeedTable())(
    'maps $name exactly as the plan does',
    (row) => {
      const seed = SEED_EXERCISES.find((e) => e.name === row.name)
      expect(seed).toBeDefined()
      expect(seed?.equipment).toBe(row.equipment)
      expect(seed?.loadType).toBe(row.loadType)
      expect(seed?.primaryMuscles).toEqual(row.primary)
      expect(seed?.secondaryMuscles).toEqual(row.secondary)
    },
  )

  it('satisfies the exercise muscle rules for every row', () => {
    for (const seed of SEED_EXERCISES) {
      expect(
        findMuscleProblem(seed.primaryMuscles, seed.secondaryMuscles),
        seed.name,
      ).toBeNull()
    }
  })

  it('gives every exercise a unique deterministic id and name key', () => {
    const ids = SEED_EXERCISES.map((e) => seedId(e.name))
    expect(new Set(ids).size).toBe(46)
    expect(ids.every((id) => id.startsWith('seed-'))).toBe(true)
    expect(new Set(SEED_EXERCISES.map((e) => toNameKey(e.name))).size).toBe(46)
  })

  it('builds slugs from names', () => {
    expect(slugify('Push-Up')).toBe('push-up')
    expect(slugify('T-Bar Row')).toBe('t-bar-row')
    expect(seedId('Barbell Bench Press')).toBe('seed-barbell-bench-press')
  })
})

describe('seedIfNeeded', () => {
  beforeEach(resetDb)

  it('seeds the library on first launch and records the version', async () => {
    expect(await seedIfNeeded()).toBe(true)

    const rows = await db.exercises.toArray()
    expect(rows).toHaveLength(46)
    expect((await db.settings.get('seedVersion'))?.value).toBe(SEED_VERSION)
  })

  it('writes the plan defaults on every seeded exercise', async () => {
    await seedIfNeeded()
    for (const row of await db.exercises.toArray()) {
      expect(row.isCustom).toBe(false)
      expect(row.defaultRestSec).toBeNull()
      expect(row.incrementKg).toBe(2.5)
      expect(row.notes).toBe('')
      expect(row.archivedAt).toBeNull()
      expect(row.deletedAt).toBeNull()
      expect(row.nameKey).toBe(toNameKey(row.name))
      expect(row.id).toBe(seedId(row.name))
    }
  })

  it('seeds only once', async () => {
    await seedIfNeeded()
    const before = await db.exercises.toArray()

    expect(await seedIfNeeded()).toBe(false)
    expect(await db.exercises.toArray()).toEqual(before)
  })

  it('seeds once even when two launches race', async () => {
    const results = await Promise.all([seedIfNeeded(), seedIfNeeded()])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await db.exercises.count()).toBe(46)
  })

  it('produces the same ids after a reinstall', async () => {
    await seedIfNeeded()
    const first = (await db.exercises.toArray()).map((e) => e.id).sort()

    await resetDb()
    await seedIfNeeded()
    const second = (await db.exercises.toArray()).map((e) => e.id).sort()

    expect(second).toEqual(first)
  })

  it('does not overwrite or resurrect rows when a newer seed version runs', async () => {
    await seedIfNeeded()
    await db.exercises.update(seedId('Deadlift'), {
      name: 'My Deadlift',
      archivedAt: 5,
      updatedAt: 5,
    })
    await db.exercises.update(seedId('Pull-Up'), { deletedAt: 9, updatedAt: 9 })
    await db.exercises.delete(seedId('Cable Fly')) // stands in for a new seed row
    await db.settings.put({ key: 'seedVersion', value: 0, updatedAt: 0 })

    expect(await seedIfNeeded()).toBe(true)

    expect(await db.exercises.count()).toBe(46)
    const deadlift = await db.exercises.get(seedId('Deadlift'))
    expect(deadlift).toMatchObject({ name: 'My Deadlift', archivedAt: 5 })
    expect((await db.exercises.get(seedId('Pull-Up')))?.deletedAt).toBe(9)
    expect(await db.exercises.get(seedId('Cable Fly'))).toBeDefined()
  })
})
