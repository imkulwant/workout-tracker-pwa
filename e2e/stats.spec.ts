import { expect, test, type Page } from '@playwright/test'
import { fixToday, seedFinishedWorkouts } from './helpers.ts'

/** Four workouts: Tue 10, Mon 9, Sun 8 and Sat 7 Nov 2026, with "today" as Wed 11 Nov. */
async function openStats(page: Page, workouts = 4) {
  await fixToday(page)
  await page.goto('./')
  await seedFinishedWorkouts(page, workouts)
  await page.goto('stats')
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
}

const cell = (page: Page, label: RegExp | string) =>
  page.getByRole('button', { name: label })

test.describe('summary tiles', () => {
  test('show this week and the weekly streak', async ({ page }) => {
    await openStats(page)
    const week = page.getByRole('region', { name: 'This week' })
    // Mon 9 and Tue 10 are this week. Sat 7 and Sun 8 are last week.
    await expect(
      week.getByText('Workouts', { exact: true }).locator('..'),
    ).toContainText('2')
    await expect(
      week.getByText('Sets', { exact: true }).locator('..'),
    ).toContainText('2')
    await expect(
      week.getByText('Volume', { exact: true }).locator('..'),
    ).toContainText('1,000 kg')
    await expect(
      week.getByText('Streak', { exact: true }).locator('..'),
    ).toContainText('2 weeks')
  })

  test('start at zero on a fresh install', async ({ page }) => {
    await fixToday(page)
    await page.goto('stats')
    const week = page.getByRole('region', { name: 'This week' })
    await expect(
      week.getByText('Streak', { exact: true }).locator('..'),
    ).toContainText('0 weeks')
    await expect(
      week.getByText('Volume', { exact: true }).locator('..'),
    ).toContainText('0 kg')
  })
})

test.describe('calendar heatmap', () => {
  test('has a cell per day up to today, in 53 Monday-start weeks', async ({
    page,
  }) => {
    await openStats(page)
    // 53 weeks of 7 days, minus Thu 12 to Sun 15 Nov, which have not happened.
    await expect(page.locator('button[data-date]')).toHaveCount(53 * 7 - 4)
    await expect(cell(page, /^Wed 11 Nov:/)).toBeVisible()
    await expect(cell(page, /^Thu 12 Nov:/)).toHaveCount(0)
  })

  test('opens on the current week', async ({ page }) => {
    await openStats(page)
    await expect(cell(page, /^Wed 11 Nov:/)).toBeInViewport()
    await expect(cell(page, /^Sun 15 Nov:/)).toHaveCount(0)
  })

  test('shades days with training, and says what each holds', async ({
    page,
  }) => {
    await openStats(page)
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toBeVisible()
    // Four days of one set each tie, so they all rank at the lowest level.
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toHaveAttribute(
      'data-level',
      '1',
    )
    await expect(cell(page, 'Wed 11 Nov: no training')).toHaveAttribute(
      'data-level',
      '0',
    )
  })

  test('makes every day level 2 when there are fewer than four', async ({
    page,
  }) => {
    await openStats(page, 3)
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toHaveAttribute(
      'data-level',
      '2',
    )
    await expect(cell(page, 'Mon 9 Nov: 1 set')).toHaveAttribute(
      'data-level',
      '2',
    )
  })

  test('switches between sets, volume and duration', async ({ page }) => {
    await openStats(page)
    await page.getByRole('button', { name: 'Volume', exact: true }).click()
    await expect(cell(page, 'Tue 10 Nov: 500 kg')).toBeVisible()
    await page.getByRole('button', { name: 'Duration', exact: true }).click()
    await expect(cell(page, 'Tue 10 Nov: 1 h 00 min')).toBeVisible()
  })

  test('filters by body part', async ({ page }) => {
    await openStats(page)
    const group = page.getByRole('group', { name: 'Body part' })
    await group.getByRole('button', { name: 'Chest' }).click()
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toBeVisible()
    await group.getByRole('button', { name: 'Legs' }).click()
    await expect(cell(page, 'Tue 10 Nov: no training')).toBeVisible()
  })

  test('opens the day in a sheet, with a link to the workout', async ({
    page,
  }) => {
    await openStats(page)
    await cell(page, /^Tue 10 Nov/).click()
    const sheet = page.getByRole('dialog', { name: '10 Nov 2026' })
    await expect(sheet.getByRole('link', { name: /Seeded 0/ })).toBeVisible()
    await sheet.getByRole('link', { name: /Seeded 0/ }).click()
    await expect(page).toHaveURL(/\/history\/seeded-w-0$/)
  })

  test('says so for a day with no workout', async ({ page }) => {
    await openStats(page)
    await cell(page, /^Wed 11 Nov/).click()
    await expect(
      page
        .getByRole('dialog', { name: '11 Nov 2026' })
        .getByText('No workouts on this day.'),
    ).toBeVisible()
  })

  test('has a visible colour key', async ({ page }) => {
    await openStats(page)
    const key = page.getByRole('list', { name: /^Colour key/ }).first()
    await expect(key).toBeVisible()
    await expect(key.getByRole('listitem')).toHaveText([
      'none',
      'low',
      'some',
      'high',
      'highest',
    ])
  })
})
