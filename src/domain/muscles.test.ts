import { describe, expect, it } from 'vitest'
import {
  BODY_PART_MUSCLES,
  BODY_PARTS,
  MUSCLE_IDS,
  bodyPartOf,
  isMuscleId,
} from './muscles'
import type { BodyPart, MuscleId } from './types'

// Hand-copied from the plan's "Body-part mapping" paragraph.
const EXPECTED: [MuscleId, BodyPart][] = [
  ['chest', 'chest'],
  ['lats', 'back'],
  ['upper_back', 'back'],
  ['traps', 'back'],
  ['lower_back', 'back'],
  ['front_delts', 'shoulders'],
  ['side_delts', 'shoulders'],
  ['rear_delts', 'shoulders'],
  ['biceps', 'arms'],
  ['triceps', 'arms'],
  ['forearms', 'arms'],
  ['glutes', 'legs'],
  ['quads', 'legs'],
  ['hamstrings', 'legs'],
  ['adductors', 'legs'],
  ['calves', 'legs'],
  ['abs', 'core'],
  ['obliques', 'core'],
]

describe('muscles', () => {
  it('defines the 18 muscle ids and 6 body parts from the plan', () => {
    expect(MUSCLE_IDS).toHaveLength(18)
    expect(BODY_PARTS).toHaveLength(6)
  })

  it.each(EXPECTED)('maps %s to %s', (muscle, part) => {
    expect(bodyPartOf(muscle)).toBe(part)
    expect(BODY_PART_MUSCLES[part]).toContain(muscle)
  })

  it('lists every muscle in exactly one body part', () => {
    const listed = BODY_PARTS.flatMap((part) => BODY_PART_MUSCLES[part])
    expect([...listed].sort()).toEqual([...MUSCLE_IDS].sort())
  })

  it('recognises muscle ids and rejects other strings', () => {
    expect(isMuscleId('quads')).toBe(true)
    expect(isMuscleId('quadriceps')).toBe(false)
    expect(isMuscleId('toString')).toBe(false)
  })
})
