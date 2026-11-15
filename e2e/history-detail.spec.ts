import { expect, test, type Page } from '@playwright/test'
import { BENCH, card, enter, reps, seedFinishedWorkouts } from './helpers.ts'

async function openSeeded(page: Page, count = 1, index = 0) {
  await page.goto('./')
  await seedFinishedWorkouts(page, count)
  await page.goto(`history/seeded-w-${index}`)
  await expect(
    page.getByRole('heading', { name: `Seeded ${index}` }),
  ).toBeVisible()
}

const edit = (page: Page) => page.getByRole('dialog', { name: 'Edit workout' })

test.describe('workout detail', () => {
  test('shows the workout, its totals and its sets', async ({ page }) => {
    await openSeeded(page)

    await expect(page.getByText('10 Nov 2026')).toBeVisible()
    await expect(page.getByText('500 kg')).toBeVisible()
    await expect(card(page, BENCH)).toBeVisible()
    await expect(card(page, BENCH).getByLabel('Reps for set 1')).toHaveValue(
      '5',
    )
  })

  test('opens from the history list and goes back to it', async ({ page }) => {
    await page.goto('./')
    await seedFinishedWorkouts(page, 3)
    await page.goto('history')
    await page.getByRole('link', { name: /Seeded 1/ }).click()
    await expect(page).toHaveURL(/\/history\/seeded-w-1$/)

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/history$/)
  })

  test('editing a set changes the totals and keeps the change', async ({
    page,
  }) => {
    await openSeeded(page)
    await enter(reps(card(page, BENCH), 1), '8')

    await expect(page.getByText('800 kg')).toBeVisible()
    await page.reload()
    await expect(page.getByText('800 kg')).toBeVisible()
  })

  test('changing the date moves it in history and updates every set', async ({
    page,
  }) => {
    await openSeeded(page, 2)
    await page.getByRole('button', { name: 'Edit details' }).click()
    await edit(page).getByLabel('Date').fill('2026-10-20')
    await edit(page).getByRole('button', { name: 'Save details' }).click()
    await expect(edit(page)).toBeHidden()
    await expect(page.getByText('20 Oct 2026')).toBeVisible()

    const setDate = await page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const open = indexedDB.open('gym-tracker')
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const get = open.result
              .transaction('sets')
              .objectStore('sets')
              .get('seeded-s-0')
            get.onsuccess = () => resolve(get.result.date)
          }
        }),
    )
    expect(setDate).toBe('2026-10-20')

    await page.goto('history')
    const weeks = page.getByRole('region', { name: /^Week of/ })
    await expect(weeks.nth(0)).toHaveAccessibleName('Week of Mon 9 Nov')
    await expect(weeks.nth(1)).toHaveAccessibleName('Week of Mon 19 Oct')
    await expect(
      weeks.nth(1).getByRole('link', { name: /Seeded 0/ }),
    ).toBeVisible()
  })

  test('edits the title and notes', async ({ page }) => {
    await openSeeded(page)
    await page.getByRole('button', { name: 'Edit details' }).click()
    await edit(page).getByLabel('Title').fill('Heavy bench')
    await edit(page).getByLabel('Notes').fill('Felt strong')
    await edit(page).getByRole('button', { name: 'Save details' }).click()

    await expect(
      page.getByRole('heading', { name: 'Heavy bench' }),
    ).toBeVisible()
    await expect(page.getByText('Felt strong')).toBeVisible()
    await page.goto('history')
    await expect(page.getByRole('link', { name: /Heavy bench/ })).toBeVisible()
  })

  test('refuses an end time before the start', async ({ page }) => {
    await openSeeded(page)
    await page.getByRole('button', { name: 'Edit details' }).click()
    await edit(page).getByLabel('End time').fill('00:00')
    await edit(page).getByLabel('Start time').fill('09:00')
    await edit(page).getByRole('button', { name: 'Save details' }).click()

    await expect(edit(page).getByRole('alert')).toHaveText(
      'The end must be after the start.',
    )
  })

  test('adds an exercise to a past workout', async ({ page }) => {
    await openSeeded(page)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    const picker = page.getByRole('dialog', { name: 'Add exercises' })
    await picker.getByRole('searchbox').fill('Barbell Row')
    await picker.getByRole('checkbox', { name: /^Barbell Row/ }).click()
    await picker.getByRole('button', { name: /^Add 1 exercise/ }).click()

    await expect(card(page, 'Barbell Row')).toBeVisible()
  })

  test('deletes after confirming, and Undo brings it back', async ({
    page,
  }) => {
    await openSeeded(page)
    await page.getByRole('button', { name: 'Delete workout' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete this workout?' })
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Seeded 0' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete workout' }).click()
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.getByText('No workouts yet')).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('link', { name: /Seeded 0/ })).toBeVisible()
    await page.getByRole('link', { name: /Seeded 0/ }).click()
    await expect(card(page, BENCH).getByLabel('Reps for set 1')).toHaveValue(
      '5',
    )
  })

  test('says so for a workout that does not exist', async ({ page }) => {
    await page.goto('history/nope')
    await expect(page.getByText('Workout not found')).toBeVisible()
  })
})
