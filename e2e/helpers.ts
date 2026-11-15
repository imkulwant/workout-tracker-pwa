import { expect, type Locator, type Page } from '@playwright/test'

// Locators and flows shared by the workout specs.

export const BENCH = 'Barbell Bench Press'

/** An exercise card of the active workout. */
export const card = (page: Page, exercise: string) =>
  page.getByRole('region', { name: exercise })
export const weight = (c: Locator, n: number) =>
  c.getByLabel(`Weight for set ${n}`)
export const reps = (c: Locator, n: number) => c.getByLabel(`Reps for set ${n}`)
export const tick = (c: Locator, n: number) =>
  c.getByRole('checkbox', { name: `Complete set ${n}` })
export const options = (c: Locator, n: number) =>
  c.getByRole('button', { name: `Set ${n} options` })
export const setRows = (c: Locator) => c.getByRole('listitem')

/** The exercise names of the active workout, in order. */
export const cardNames = (page: Page) => page.locator('section[aria-label] h2')

/** Starts a workout from Today and adds the named exercises through the picker. */
export async function startWith(page: Page, ...names: string[]) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await expect(page).toHaveURL(/\/workout$/)
  if (names.length === 0) return
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  for (const name of names) {
    await picker.getByRole('searchbox', { name: 'Search exercises' }).fill(name)
    await picker.getByRole('checkbox', { name: new RegExp(`^${name}`) }).click()
  }
  await picker.getByRole('button', { name: /^Add \d+ exercises?$/ }).click()
  for (const name of names) await expect(card(page, name)).toBeVisible()
}

/** Types into a field and leaves it, which is what stores it. */
export async function enter(field: Locator, text: string) {
  await field.fill(text)
  await field.blur()
}

/** Fills set `n` and ticks it. */
export async function logSet(
  c: Locator,
  n: number,
  weightText: string,
  repsText: string,
) {
  await enter(weight(c, n), weightText)
  await enter(reps(c, n), repsText)
  await tick(c, n).click()
  await expect(tick(c, n)).toHaveAttribute('aria-checked', 'true')
}

/**
 * Moves the workout in progress, and the sets ticked in it, back in time. The
 * app has no way to start a workout in the past, so this edits the stored rows.
 */
export async function ageActiveWorkout(page: Page, hours: number) {
  await page.evaluate(async (ms) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gym-tracker')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction(['workouts', 'sets'], 'readwrite')
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    const workouts = tx.objectStore('workouts')
    const sets = tx.objectStore('sets')
    workouts.getAll().onsuccess = (event) => {
      for (const workout of (event.target as IDBRequest).result) {
        if (workout.status !== 'active') continue
        workouts.put({ ...workout, startedAt: workout.startedAt - ms })
        sets.getAll().onsuccess = (setsEvent) => {
          for (const set of (setsEvent.target as IDBRequest).result) {
            if (set.workoutId !== workout.id || set.completedAt === null)
              continue
            sets.put({ ...set, completedAt: set.completedAt - ms })
          }
        }
      }
    }
    await done
    db.close()
  }, hours * 3_600_000)
}

/**
 * Writes finished workouts straight into IndexedDB, newest first: workout `i`
 * is `i` days before `latest`, with one 100 kg x 5 bench set. For lists that
 * would take too long to log by hand.
 */
export async function seedFinishedWorkouts(
  page: Page,
  count: number,
  latest = '2026-11-10',
) {
  // Opening the database before the app has created it would leave it empty.
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.evaluate(
    async ({ count, latest }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('gym-tracker')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const tx = db.transaction(
        ['workouts', 'workoutExercises', 'sets'],
        'readwrite',
      )
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      const [year, month, day] = latest.split('-').map(Number) as [
        number,
        number,
        number,
      ]
      for (let i = 0; i < count; i++) {
        const noon = Date.UTC(year, month - 1, day - i, 12)
        const date = new Date(noon).toISOString().slice(0, 10)
        const entity = { createdAt: noon, updatedAt: noon, deletedAt: null }
        tx.objectStore('workouts').put({
          ...entity,
          id: `seeded-w-${i}`,
          date,
          startedAt: noon,
          endedAt: noon + 3_600_000,
          status: 'completed',
          title: `Seeded ${i}`,
          notes: '',
          templateId: null,
        })
        tx.objectStore('workoutExercises').put({
          ...entity,
          id: `seeded-we-${i}`,
          workoutId: `seeded-w-${i}`,
          exerciseId: 'seed-barbell-bench-press',
          position: 0,
          notes: '',
        })
        tx.objectStore('sets').put({
          ...entity,
          id: `seeded-s-${i}`,
          workoutId: `seeded-w-${i}`,
          workoutExerciseId: `seeded-we-${i}`,
          exerciseId: 'seed-barbell-bench-press',
          date,
          position: 0,
          type: 'working',
          weightKg: 100,
          reps: 5,
          completedAt: noon + 600_000,
        })
      }
      await done
      db.close()
    },
    { count, latest },
  )
}

/** Writes one row of the settings table straight into IndexedDB. */
export async function putSetting(page: Page, key: string, value: unknown) {
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.evaluate(
    async ({ key, value }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('gym-tracker')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const tx = db.transaction('settings', 'readwrite')
      tx.objectStore('settings').put({ key, value, updatedAt: Date.now() })
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    { key, value },
  )
}
