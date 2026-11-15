import { startWorkoutFromTemplate } from '../../data/repositories/templates'
import type { Id } from '../../domain/types'

/** Starts a workout from a template, then opens it. */
export async function startFromTemplate(
  templateId: Id,
  open: (path: string) => void,
): Promise<void> {
  await startWorkoutFromTemplate(templateId)
  open('/workout')
}
