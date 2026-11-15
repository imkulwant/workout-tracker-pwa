import { seedIfNeeded } from '../data/seed'
import { requestPersistence } from '../platform/storage'

/**
 * Work that must finish before the first screen: ask the browser to keep the
 * app's storage, then seed the exercise library on the first launch. Rejects
 * if storage cannot be opened, so the app can say so instead of showing a
 * screen that cannot save anything.
 */
export async function bootstrap(): Promise<void> {
  // Never throws, and the result is shown in Settings, so it is not needed here.
  await requestPersistence()
  await seedIfNeeded()
}
