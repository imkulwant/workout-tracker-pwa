import { vi } from 'vitest'
import { createExercise } from '../data/repositories/exercises'
import type { Exercise } from '../domain/types'

/** Epoch ms for a local date and time. Month is 1-based, like the plan. */
export const at = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()

/** Fixes `Date.now()` only, so IndexedDB timers keep running. */
export function freezeTime(ms: number): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ms)
}

export function unfreezeTime(): void {
  vi.useRealTimers()
}

export function makeExercise(name = 'Bench Press'): Promise<Exercise> {
  return createExercise({
    name,
    equipment: 'barbell',
    loadType: 'weight_reps',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
  })
}
