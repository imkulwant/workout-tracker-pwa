import type { BodyPart, MuscleId } from './types'

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  upper_back: 'Upper back',
  traps: 'Traps',
  lower_back: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
}

export const MUSCLE_IDS = Object.keys(MUSCLE_LABELS) as MuscleId[]

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
}

export const BODY_PARTS = Object.keys(BODY_PART_LABELS) as BodyPart[]

export const BODY_PART_MUSCLES: Record<BodyPart, readonly MuscleId[]> = {
  chest: ['chest'],
  back: ['lats', 'upper_back', 'traps', 'lower_back'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['glutes', 'quads', 'hamstrings', 'adductors', 'calves'],
  core: ['abs', 'obliques'],
}

const MUSCLE_BODY_PART = new Map<MuscleId, BodyPart>(
  BODY_PARTS.flatMap((part) =>
    BODY_PART_MUSCLES[part].map((muscle): [MuscleId, BodyPart] => [
      muscle,
      part,
    ]),
  ),
)

export function bodyPartOf(muscle: MuscleId): BodyPart {
  const part = MUSCLE_BODY_PART.get(muscle)
  if (!part) throw new Error(`Muscle has no body part: ${muscle}`)
  return part
}

export function isMuscleId(value: string): value is MuscleId {
  return Object.hasOwn(MUSCLE_LABELS, value)
}
