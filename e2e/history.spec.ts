import { expect, test } from '@playwright/test'
import {
  BENCH,
  card,
  logSet,
  seedFinishedWorkouts,
  startWith,
} from './helpers.ts'

test.describe('history list', () => {
  test('says so when there are no workouts', async ({ page }) => {
    await page.goto('history')
    await expect(page.getByText('No workouts yet')).toBeVisible()
  })

  test('shows a finished workout with its totals and body parts', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    await page.getByLabel('Workout title').fill('Push day')
    await page.getByLabel('Workout title').blur()
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('link', { name: 'History' }).click()
    const row = page.getByRole('link', { name: /Push day/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText('1 set')
    await expect(row).toContainText('480 kg')
    await expect(row).toContainText('Chest')
  })

  test('groups by Monday-start week, newest first', async ({ page }) => {
    await page.goto('./')
    // 2026-11-10 is a Tuesday. Seeded 0..3 fall on Tue 10, Mon 9, Sun 8, Sat 7.
    await seedFinishedWorkouts(page, 4)
    await page.goto('history')

    const weeks = page.getByRole('region', { name: /^Week of/ })
    await expect(weeks).toHaveCount(2)
    await expect(weeks.nth(0)).toHaveAccessibleName('Week of Mon 9 Nov')
    await expect(weeks.nth(1)).toHaveAccessibleName('Week of Mon 2 Nov')
    await expect(weeks.nth(0).getByRole('link')).toHaveCount(2)
    await expect(weeks.nth(0).getByRole('link').first()).toContainText(
      'Seeded 0',
    )
    await expect(weeks.nth(1).getByRole('link').first()).toContainText(
      'Seeded 2',
    )
  })

  test('shows 30 workouts at first and adds more on request', async ({
    page,
  }) => {
    await page.goto('./')
    await seedFinishedWorkouts(page, 65)
    await page.goto('history')

    const rows = page.getByRole('link', { name: /^Seeded/ })
    await expect(rows).toHaveCount(30)
    await page.getByRole('button', { name: 'Show more' }).click()
    await expect(rows).toHaveCount(60)
    await page.getByRole('button', { name: 'Show more' }).click()
    await expect(rows).toHaveCount(65)
    await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0)
  })
})
