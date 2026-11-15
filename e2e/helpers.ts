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
