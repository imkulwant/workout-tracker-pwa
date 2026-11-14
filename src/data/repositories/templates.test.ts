import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../../test/db'
import { freezeTime, unfreezeTime } from '../../test/fixtures'
import type { TemplateItem } from '../../domain/types'
import { db } from '../db'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from './templates'

beforeEach(resetDb)
afterEach(unfreezeTime)

const item = (overrides: Partial<TemplateItem> = {}): TemplateItem => ({
  exerciseId: 'seed-barbell-bench-press',
  targetSets: 3,
  targetReps: 8,
  restSec: 120,
  ...overrides,
})

describe('templates', () => {
  it('creates a template with trimmed name and timestamps', async () => {
    freezeTime(1_000)

    const template = await createTemplate({
      name: '  Push A ',
      items: [item()],
    })

    expect(template).toMatchObject({
      name: 'Push A',
      notes: '',
      items: [item()],
      deletedAt: null,
      createdAt: 1_000,
      updatedAt: 1_000,
    })
    expect(await db.templates.get(template.id)).toEqual(template)
  })

  it('does not share item objects with the caller', async () => {
    const items = [item()]
    const template = await createTemplate({ name: 'Push A', items })
    items[0]!.targetSets = 99
    expect((await getTemplate(template.id))?.items[0]?.targetSets).toBe(3)
  })

  it('rejects an empty name and invalid items, writing nothing', async () => {
    await expect(createTemplate({ name: '  ' })).rejects.toThrow(/name/)
    await expect(
      createTemplate({ name: 'x', items: [item({ targetSets: 0 })] }),
    ).rejects.toThrow(/sets/)
    await expect(
      createTemplate({ name: 'x', items: [item({ targetReps: 1000 })] }),
    ).rejects.toThrow(/reps/)
    await expect(
      createTemplate({ name: 'x', items: [item({ restSec: -1 })] }),
    ).rejects.toThrow(/Rest/)
    expect(await db.templates.count()).toBe(0)
  })

  it('allows null target reps and rest', async () => {
    await expect(
      createTemplate({
        name: 'Flexible',
        items: [item({ targetReps: null, restSec: null })],
      }),
    ).resolves.toBeDefined()
  })

  it('updates fields and sets updatedAt', async () => {
    freezeTime(1_000)
    const template = await createTemplate({ name: 'Push A', items: [item()] })
    freezeTime(2_000)

    const updated = await updateTemplate(template.id, {
      name: 'Push B',
      items: [item({ targetSets: 4 })],
    })

    expect(updated).toMatchObject({
      name: 'Push B',
      updatedAt: 2_000,
      createdAt: 1_000,
    })
    expect(updated.items[0]?.targetSets).toBe(4)
  })

  it('rejects an invalid update and leaves the stored row untouched', async () => {
    const template = await createTemplate({ name: 'Push A', items: [item()] })

    await expect(
      updateTemplate(template.id, { items: [item({ targetSets: 0 })] }),
    ).rejects.toThrow(/sets/)

    expect(await db.templates.get(template.id)).toEqual(template)
  })

  it('soft-deletes, and reads then exclude the template', async () => {
    freezeTime(1_000)
    const template = await createTemplate({ name: 'Push A' })
    freezeTime(2_000)

    await deleteTemplate(template.id)

    expect(await db.templates.get(template.id)).toMatchObject({
      deletedAt: 2_000,
      updatedAt: 2_000,
    })
    expect(await getTemplate(template.id)).toBeUndefined()
    expect(await listTemplates()).toEqual([])
    await expect(updateTemplate(template.id, { notes: 'x' })).rejects.toThrow(
      'Template not found',
    )
  })

  it('lists templates by name', async () => {
    await createTemplate({ name: 'Pull' })
    await createTemplate({ name: 'Legs' })
    await createTemplate({ name: 'Push' })

    expect((await listTemplates()).map((t) => t.name)).toEqual([
      'Legs',
      'Pull',
      'Push',
    ])
  })
})
