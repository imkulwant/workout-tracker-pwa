import type { Id, Template, TemplateItem } from '../../domain/types'
import { isValidReps } from '../../domain/numbers'
import { db } from '../db'
import {
  InvariantError,
  isLive,
  liveOrUndefined,
  newId,
  requireLive,
  tombstone,
} from './common'

export interface TemplateInput {
  name: string
  notes?: string
  items?: TemplateItem[]
}

function validate(template: Template): void {
  if (template.name === '')
    throw new InvariantError('Template name is required')
  for (const item of template.items) {
    if (!Number.isInteger(item.targetSets) || item.targetSets < 1) {
      throw new InvariantError(
        'Target sets must be a whole number of at least 1',
      )
    }
    if (item.targetReps !== null && !isValidReps(item.targetReps)) {
      throw new InvariantError(
        'Target reps must be a whole number from 1 to 999',
      )
    }
    if (
      item.restSec !== null &&
      (!Number.isInteger(item.restSec) || item.restSec < 0)
    ) {
      throw new InvariantError('Rest must be a whole number of seconds')
    }
  }
}

export async function createTemplate(input: TemplateInput): Promise<Template> {
  const now = Date.now()
  const template: Template = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: input.name.trim(),
    notes: input.notes ?? '',
    items: (input.items ?? []).map((item) => ({ ...item })),
  }
  validate(template)
  await db.templates.add(template)
  return template
}

export async function updateTemplate(
  id: Id,
  patch: Partial<TemplateInput>,
): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const current = requireLive(await db.templates.get(id), 'Template')
    const next: Template = {
      ...current,
      name: patch.name !== undefined ? patch.name.trim() : current.name,
      notes: patch.notes ?? current.notes,
      items: patch.items
        ? patch.items.map((item) => ({ ...item }))
        : current.items,
      updatedAt: Date.now(),
    }
    validate(next)
    await db.templates.put(next)
    return next
  })
}

export async function deleteTemplate(id: Id): Promise<void> {
  await db.transaction('rw', db.templates, async () => {
    const current = requireLive(await db.templates.get(id), 'Template')
    await db.templates.put(tombstone(current, Date.now()))
  })
}

export async function getTemplate(id: Id): Promise<Template | undefined> {
  return liveOrUndefined(await db.templates.get(id))
}

export async function listTemplates(): Promise<Template[]> {
  return db.templates.orderBy('name').filter(isLive).toArray()
}
