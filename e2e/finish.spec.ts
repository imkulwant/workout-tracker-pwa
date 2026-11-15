import { expect, test, type Page } from '@playwright/test'
import { BENCH, card, logSet, startWith, tick } from './helpers.ts'

const finishButton = (page: Page) =>
  page.getByRole('button', { name: 'Finish', exact: true })

test.describe('finishing a workout', () => {
  test('start, log three sets, reload mid-workout, resume, finish', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await c.getByRole('button', { name: 'Add set' }).click()
    await c.getByRole('button', { name: 'Add set' }).click()
    await logSet(c, 1, '60', '8')

    await page.reload()
    await expect(page).toHaveURL(/\/workout$/)
    await logSet(card(page, BENCH), 2, '62,5', '8')
    await logSet(card(page, BENCH), 3, '65', '6')

    await finishButton(page).click()

    await expect(page).toHaveURL(/\/workout\/[^/]+\/summary$/)
    await expect(
      page.getByRole('heading', { name: 'Workout done' }),
    ).toBeVisible()
    await expect(page.getByText('Sets', { exact: true })).toBeVisible()
    // 60 x 8 + 62.5 x 8 + 65 x 6 = 480 + 500 + 390
    await expect(page.getByText('1,370 kg')).toBeVisible()
    await expect(page.getByText('Chest', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()
    await expect(
      page.getByRole('button', { name: 'Start workout' }),
    ).toBeVisible()
    await page.reload()
    await expect(page).not.toHaveURL(/\/workout$/)
  })

  test("shows the finished session as the next one's previous sets", async ({
    page,
  }) => {
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await finishButton(page).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await startWith(page, BENCH)
    await expect(card(page, BENCH).getByText('60 × 8').first()).toBeVisible()
  })

  test('offers Discard when nothing was completed', async ({ page }) => {
    await startWith(page, BENCH)
    await finishButton(page).click()

    const dialog = page.getByRole('dialog', { name: 'Nothing logged' })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Discard incomplete' }),
    ).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(card(page, BENCH)).toBeVisible()

    await finishButton(page).click()
    await dialog.getByRole('button', { name: 'Discard workout' }).click()
    await expect(
      page.getByRole('button', { name: 'Start workout' }),
    ).toBeVisible()
  })

  test('drops unticked sets on Discard incomplete, or keeps editing', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await c.getByRole('button', { name: 'Add set' }).click()
    await logSet(c, 1, '60', '8')

    await finishButton(page).click()
    const dialog = page.getByRole('dialog', { name: 'Unfinished sets' })
    await expect(dialog).toContainText('1 set is not completed.')
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(tick(c, 2)).toBeVisible()

    await finishButton(page).click()
    await dialog.getByRole('button', { name: 'Discard incomplete' }).click()
    await expect(page).toHaveURL(/\/summary$/)
    await expect(page.getByText('480 kg')).toBeVisible()
  })

  test('stops the rest timer when the workout is finished', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible()
    await finishButton(page).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await startWith(page, BENCH)
    await page.waitForTimeout(500)
    await expect(page.getByRole('region', { name: 'Rest timer' })).toBeHidden()
  })
})
