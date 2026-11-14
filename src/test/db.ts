import { db } from '../data/db'

/** Empties the app database so each test starts from nothing. */
export async function resetDb(): Promise<void> {
  await db.delete()
  await db.open()
}
