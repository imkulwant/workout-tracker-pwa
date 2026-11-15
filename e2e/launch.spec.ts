import { expect, test, type Page } from '@playwright/test'
import { ageActiveWorkout, BENCH, card, logSet, startWith } from './helpers.ts'

const prompt = (page: Page) =>
  page.getByRole('dialog', { name: 'Workout still open' })

test.describe('launch with a workout in progress', () => {
  test('opens the workout whatever address the app is opened at', async ({
    page,
  }) => {
    await startWith(page, BENCH)

    await page.goto('exercises')
    await expect(page).toHaveURL(/\/workout$/)
    await expect(card(page, BENCH)).toBeVisible()
    await expect(prompt(page)).toBeHidden()
  })

  test('lets you leave the workout screen once the app is open', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    await page.reload()
    await expect(card(page, BENCH)).toBeVisible()

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).not.toHaveURL(/\/workout$/)
    await page.getByRole('link', { name: 'Exercises' }).click()
    await expect(page).toHaveURL(/\/exercises$/)
  })

  test('stays where it is opened when no workout is in progress', async ({
    page,
  }) => {
    await page.goto('exercises')
    await expect(page).toHaveURL(/\/exercises$/)
  })
})

test.describe('a workout left open for more than 12 hours', () => {
  async function leftOpen(page: Page, ticked = true) {
    await startWith(page, BENCH)
    if (ticked) await logSet(card(page, BENCH), 1, '60', '8')
    await ageActiveWorkout(page, 13)
    await page.reload()
    await expect(prompt(page)).toBeVisible()
  }

  test('does not ask about a recent workout', async ({ page }) => {
    await startWith(page, BENCH)
    await ageActiveWorkout(page, 11)
    await page.reload()
    await expect(card(page, BENCH)).toBeVisible()
    await expect(prompt(page)).toBeHidden()
  })

  test('continues the workout', async ({ page }) => {
    await leftOpen(page)
    await prompt(page).getByRole('button', { name: 'Continue workout' }).click()
    await expect(prompt(page)).toBeHidden()
    await expect(card(page, BENCH)).toBeVisible()
  })

  test('finishes it at the last completed set', async ({ page }) => {
    await leftOpen(page)
    await prompt(page)
      .getByRole('button', { name: 'Finish at last completed set' })
      .click()

    await expect(page).not.toHaveURL(/\/workout$/)
    await expect(
      page.getByRole('button', { name: 'Start workout' }),
    ).toBeVisible()
    await page.reload()
    await expect(prompt(page)).toBeHidden()
  })

  test('discards it', async ({ page }) => {
    await leftOpen(page)
    await prompt(page).getByRole('button', { name: 'Discard workout' }).click()

    await expect(
      page.getByRole('button', { name: 'Start workout' }),
    ).toBeVisible()
    await page.reload()
    await expect(page).not.toHaveURL(/\/workout$/)
  })

  test('does not offer to finish a workout with no completed set', async ({
    page,
  }) => {
    await leftOpen(page, false)
    await expect(
      prompt(page).getByRole('button', { name: 'Continue workout' }),
    ).toBeVisible()
    await expect(
      prompt(page).getByRole('button', { name: 'Discard workout' }),
    ).toBeVisible()
    await expect(
      prompt(page).getByRole('button', { name: /^Finish/ }),
    ).toHaveCount(0)
  })
})
