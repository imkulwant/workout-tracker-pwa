import { expect, test, type Page } from '@playwright/test'
import { BENCH, card, cardNames, startWith } from './helpers.ts'

const ROW = 'Barbell Row'
const CURL = 'Barbell Curl'

const menu = (page: Page, exercise: string) =>
  page.getByRole('dialog', { name: exercise })

async function openMenu(page: Page, exercise: string) {
  await page.getByRole('button', { name: `${exercise} options` }).click()
  await expect(menu(page, exercise)).toBeVisible()
}

test.describe('exercise menu', () => {
  test('moves an exercise up and down, and keeps the order after reload', async ({
    page,
  }) => {
    await startWith(page, BENCH, ROW)
    await expect(cardNames(page)).toHaveText([BENCH, ROW])

    await openMenu(page, BENCH)
    await expect(
      menu(page, BENCH).getByRole('button', { name: 'Move up' }),
    ).toBeDisabled()
    await menu(page, BENCH).getByRole('button', { name: 'Move down' }).click()
    await expect(cardNames(page)).toHaveText([ROW, BENCH])

    await page.reload()
    await expect(cardNames(page)).toHaveText([ROW, BENCH])

    await openMenu(page, BENCH)
    await expect(
      menu(page, BENCH).getByRole('button', { name: 'Move down' }),
    ).toBeDisabled()
    await menu(page, BENCH).getByRole('button', { name: 'Move up' }).click()
    await expect(cardNames(page)).toHaveText([BENCH, ROW])
  })

  test('replaces an exercise and keeps its sets', async ({ page }) => {
    await startWith(page, BENCH)
    await card(page, BENCH).getByLabel('Weight for set 1').fill('60')
    await card(page, BENCH).getByLabel('Weight for set 1').blur()

    await openMenu(page, BENCH)
    await menu(page, BENCH)
      .getByRole('button', { name: 'Replace exercise' })
      .click()
    const picker = page.getByRole('dialog', { name: 'Replace exercise' })
    await picker.getByRole('checkbox', { name: /^Barbell Row/ }).click()
    // Single-select: choosing another switches rather than adds.
    await picker.getByRole('checkbox', { name: /^Barbell Curl/ }).click()
    await expect(picker.getByRole('checkbox', { checked: true })).toHaveCount(1)
    await picker.getByRole('button', { name: 'Use this exercise' }).click()

    await expect(cardNames(page)).toHaveText([CURL])
    await expect(card(page, CURL).getByLabel('Weight for set 1')).toHaveValue(
      '60',
    )
  })

  test('asks before removing an exercise', async ({ page }) => {
    await startWith(page, BENCH, ROW)

    await openMenu(page, BENCH)
    await menu(page, BENCH)
      .getByRole('button', { name: 'Remove exercise' })
      .click()
    const confirm = page.getByRole('dialog', { name: `Remove ${BENCH}?` })
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(cardNames(page)).toHaveText([BENCH, ROW])

    await openMenu(page, BENCH)
    await menu(page, BENCH)
      .getByRole('button', { name: 'Remove exercise' })
      .click()
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(cardNames(page)).toHaveText([ROW])
  })

  test('saves a note and shows it after reload', async ({ page }) => {
    await startWith(page, BENCH)

    await openMenu(page, BENCH)
    await menu(page, BENCH).getByRole('button', { name: 'Add note' }).click()
    await page.getByRole('textbox', { name: 'Note' }).fill('Pause at the chest')
    await page.getByRole('button', { name: 'Save note' }).click()
    await expect(
      card(page, BENCH).getByText('Pause at the chest'),
    ).toBeVisible()

    await page.reload()
    await expect(
      card(page, BENCH).getByText('Pause at the chest'),
    ).toBeVisible()
    await openMenu(page, BENCH)
    await expect(
      menu(page, BENCH).getByRole('button', { name: 'Edit note' }),
    ).toBeVisible()
  })

  test('opens the exercise history and comes back', async ({ page }) => {
    await startWith(page, BENCH)

    await openMenu(page, BENCH)
    await menu(page, BENCH).getByRole('link', { name: 'View history' }).click()
    await expect(page).toHaveURL(/\/exercises\/[^/]+$/)
    await expect(page.getByRole('heading', { name: BENCH })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/workout$/)
    await expect(card(page, BENCH)).toBeVisible()
  })
})
