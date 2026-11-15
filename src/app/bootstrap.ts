import { seedIfNeeded } from '../data/seed'
import {
  countCompletedWorkouts,
  hasAnyWorkoutRows,
} from '../data/repositories/workouts'
import { dataMarker } from '../platform/dataMarker'
import { requestPersistence } from '../platform/storage'

export interface BootResult {
  /** The device once held workouts but now holds none: offer a restore first. */
  needsRestore: boolean
}

/**
 * Work that must finish before the first screen: ask the browser to keep the
 * app's storage, check that the data is still there, then seed the exercise
 * library on the first launch. Rejects if storage cannot be opened, so the app
 * can say so instead of showing a screen that cannot save anything. When data
 * was lost, nothing is seeded, so a restore starts from an empty database.
 */
export async function bootstrap(): Promise<BootResult> {
  // Never throws, and the result is shown in Settings, so it is not needed here.
  await requestPersistence()

  if (await countCompletedWorkouts()) dataMarker.mark()
  else if (dataMarker.isSet() && !(await hasAnyWorkoutRows())) {
    return { needsRestore: true }
  }

  await seedIfNeeded()
  return { needsRestore: false }
}

/** Carries on after the restore screen: either a restore ran, or an empty start was chosen. */
export async function finishRestore(): Promise<void> {
  await seedIfNeeded()
}
