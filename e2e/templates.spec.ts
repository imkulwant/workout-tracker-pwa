import { expect, test, type Page } from '@playwright/test'
import { BENCH, card, cardNames, logSet, startWith } from './helpers.ts'

const ROW = 'Barbell Row'

const exerciseSection = (page: Page, name: string) =>
  page.getByRole('region', { name: new RegExp(`^${name}, exercise`) })

/** Makes a template in the editor, with the named exercises in order. */
async function createTemplate(
  page: Page,
  name: string,
  ...exercises: string[]
) {
  await page.goto('templates/new')
  await page.getByLabel('Name', { exact: true }).fill(name)
  if (exercises.length > 0) {
    await page.getByRole('button', { name: 'Add exercises' }).click()
    const picker = page.getByRole('dialog', { name: 'Add exercises' })
    for (const exercise of exercises) {
      await picker.getByRole('searchbox').fill(exercise)
      await picker
        .getByRole('checkbox', { name: new RegExp(`^${exercise}`) })
        .click()
    }
    await picker.getByRole('button', { name: /^Add \d+ exercises?$/ }).click()
  }
  // One set each, so a workout from it is finished by ticking a single set.
  for (const exercise of exercises) {
    await exerciseSection(page, exercise).getByLabel('Sets').fill('1')
  }
  await page.getByRole('button', { name: 'Save template' }).click()
  await expect(page).toHaveURL(/\/templates$/)
}

test.describe('template editor', () => {
  test('says so when there are no templates', async ({ page }) => {
    await page.goto('templates')
    await expect(page.getByText('No templates yet')).toBeVisible()
  })

  test('creates a template, with exercises reordered and targets set', async ({
    page,
  }) => {
    await page.goto('templates/new')
    await page.getByLabel('Name', { exact: true }).fill('Push A')
    await page.getByRole('button', { name: 'Add exercises' }).click()
    const picker = page.getByRole('dialog', { name: 'Add exercises' })
    for (const name of [BENCH, ROW]) {
      await picker.getByRole('searchbox').fill(name)
      await picker
        .getByRole('checkbox', { name: new RegExp(`^${name}`) })
        .click()
    }
    await picker.getByRole('button', { name: 'Add 2 exercises' }).click()

    const bench = exerciseSection(page, BENCH)
    await bench.getByLabel('Sets').fill('4')
    await bench.getByLabel('Reps').fill('5')
    const row = exerciseSection(page, ROW)
    await row.getByLabel('Rest (s)').fill('45')
    await page.getByRole('button', { name: `Move ${ROW} up` }).click()
    await page.getByRole('button', { name: 'Save template' }).click()

    await expect(page).toHaveURL(/\/templates$/)
    const item = page.getByRole('listitem').filter({ hasText: 'Push A' })
    await expect(item).toContainText('2 exercises')
    await expect(item).toContainText(`${ROW}, ${BENCH}`)
    await expect(item).toContainText('Not used yet')

    // The saved targets come back when it is opened.
    await item.getByRole('link').click()
    await expect(exerciseSection(page, BENCH).getByLabel('Sets')).toHaveValue(
      '4',
    )
    await expect(exerciseSection(page, BENCH).getByLabel('Reps')).toHaveValue(
      '5',
    )
    await expect(exerciseSection(page, ROW).getByLabel('Rest (s)')).toHaveValue(
      '45',
    )
    await expect(
      page.getByRole('region', { name: /exercise 1$/ }),
    ).toContainText(ROW)
  })

  test('checks the name and the targets', async ({ page }) => {
    await page.goto('templates/new')
    await page.getByRole('button', { name: 'Save template' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'Template name is required',
    )

    await page.getByLabel('Name', { exact: true }).fill('X')
    await page.getByRole('button', { name: 'Add exercises' }).click()
    const picker = page.getByRole('dialog', { name: 'Add exercises' })
    await picker.getByRole('searchbox').fill(BENCH)
    await picker
      .getByRole('checkbox', { name: new RegExp(`^${BENCH}`) })
      .click()
    await picker.getByRole('button', { name: /^Add 1 exercise/ }).click()
    await exerciseSection(page, BENCH).getByLabel('Sets').fill('0')
    await page.getByRole('button', { name: 'Save template' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      `${BENCH}: Sets must be a whole number of at least 1.`,
    )
    await expect(page).toHaveURL(/\/templates\/new$/)
  })

  test('removes an exercise and edits the name', async ({ page }) => {
    await createTemplate(page, 'Pull', ROW, BENCH)
    await page.getByRole('link', { name: /Pull/ }).click()
    await page.getByRole('button', { name: `Remove ${BENCH}` }).click()
    await page.getByLabel('Name', { exact: true }).fill('Pull day')
    await page.getByRole('button', { name: 'Save template' }).click()

    const item = page.getByRole('listitem').filter({ hasText: 'Pull day' })
    await expect(item).toContainText('1 exercise ·')
    await expect(item).toContainText(ROW)
  })

  test('deletes after confirming', async ({ page }) => {
    await createTemplate(page, 'Temp', BENCH)
    await page.getByRole('link', { name: /Temp/ }).click()
    await page.getByRole('button', { name: 'Delete template' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete this template?' })
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Temp')

    await page.getByRole('button', { name: 'Delete template' }).click()
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/templates$/)
    await expect(page.getByText('No templates yet')).toBeVisible()
  })

  test('says so for a template that does not exist', async ({ page }) => {
    await page.goto('templates/nope')
    await expect(page.getByText('Template not found')).toBeVisible()
  })
})

test.describe('starting from a template', () => {
  test('opens a correctly ordered workout with the target sets, from template to finished workout', async ({
    page,
  }) => {
    await page.goto('templates/new')
    await page.getByLabel('Name', { exact: true }).fill('Push A')
    await page.getByRole('button', { name: 'Add exercises' }).click()
    const picker = page.getByRole('dialog', { name: 'Add exercises' })
    for (const name of [BENCH, ROW]) {
      await picker.getByRole('searchbox').fill(name)
      await picker
        .getByRole('checkbox', { name: new RegExp(`^${name}`) })
        .click()
    }
    await picker.getByRole('button', { name: 'Add 2 exercises' }).click()
    await exerciseSection(page, BENCH).getByLabel('Sets').fill('3')
    await exerciseSection(page, BENCH).getByLabel('Reps').fill('5')
    await exerciseSection(page, ROW).getByLabel('Sets').fill('2')
    await exerciseSection(page, ROW).getByLabel('Reps').fill('10')
    await exerciseSection(page, ROW).getByLabel('Rest (s)').fill('45')
    await page.getByRole('button', { name: `Move ${ROW} up` }).click()
    await page.getByRole('button', { name: 'Save template' }).click()

    // From Today.
    await page.goto('./')
    const section = page.getByRole('region', { name: 'Start from a template' })
    await section.getByRole('button', { name: 'Start Push A' }).click()

    await expect(page).toHaveURL(/\/workout$/)
    await expect(page.getByLabel('Workout title')).toHaveValue('Push A')
    await expect(cardNames(page)).toHaveText([ROW, BENCH])
    await expect(card(page, ROW).getByRole('listitem')).toHaveCount(2)
    await expect(card(page, BENCH).getByRole('listitem')).toHaveCount(3)
    await expect(card(page, ROW).getByLabel('Reps for set 1')).toHaveValue('10')
    await expect(card(page, BENCH).getByLabel('Reps for set 3')).toHaveValue(
      '5',
    )

    // The template's own rest applies to its exercise.
    await logSet(card(page, ROW), 1, '60', '10')
    await expect(
      page.getByRole('timer', { name: 'Rest remaining' }),
    ).toHaveText(/^0:(45|44)$/)

    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Unfinished sets' })
      .getByRole('button', { name: 'Discard incomplete' })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Workout done' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(
      page.getByRole('button', { name: 'Start workout' }),
    ).toBeVisible()
  })

  test('lists templates on Today, the most recently used first', async ({
    page,
  }) => {
    await createTemplate(page, 'Alpha', BENCH)
    await createTemplate(page, 'Beta', ROW)
    await page.goto('./')
    const names = page
      .getByRole('region', { name: 'Start from a template' })
      .getByRole('listitem')
    // Neither has been used, so the one edited last comes first.
    await expect(names).toHaveText([/Beta/, /Alpha/])

    await page.getByRole('button', { name: 'Start Alpha' }).click()
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await expect(names).toHaveText([/Alpha/, /Beta/])
    await page.getByRole('link', { name: 'Templates' }).click()
    await expect(page.getByRole('listitem').first()).toContainText('Alpha')
    await expect(page.getByRole('listitem').first()).toContainText('Last used')
  })

  test('is not offered while a workout is in progress', async ({ page }) => {
    await createTemplate(page, 'Alpha', BENCH)
    await startWith(page, ROW)
    // A reload would open the workout, so go there with the app's own links.
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('link', { name: 'Templates' }).click()
    await expect(page.getByRole('button', { name: 'Start Alpha' })).toHaveCount(
      0,
    )
    await expect(
      page.getByText(
        'Finish the workout in progress to start one from a template.',
      ),
    ).toBeVisible()
  })

  test('editing the template never changes a workout already done from it', async ({
    page,
  }) => {
    await createTemplate(page, 'Alpha', BENCH)
    await page.goto('./')
    await page.getByRole('button', { name: 'Start Alpha' }).click()
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.goto('./')
    await page.getByRole('link', { name: 'Templates' }).click()
    await page.getByRole('link', { name: /Alpha/ }).click()
    await page.getByLabel('Name', { exact: true }).fill('Renamed')
    await exerciseSection(page, BENCH).getByLabel('Sets').fill('9')
    await page.getByRole('button', { name: `Remove ${BENCH}` }).click()
    await page.getByRole('button', { name: 'Save template' }).click()
    await page.getByRole('link', { name: /Renamed/ }).click()
    await page.getByRole('button', { name: 'Delete template' }).click()
    await page
      .getByRole('dialog', { name: 'Delete this template?' })
      .getByRole('button', { name: 'Delete' })
      .click()

    await page.getByRole('link', { name: 'History' }).click()
    await page.getByRole('link', { name: /Alpha/ }).click()
    await expect(page.getByRole('heading', { name: 'Alpha' })).toBeVisible()
    await expect(card(page, BENCH).getByLabel('Weight for set 1')).toHaveValue(
      '60',
    )
    await expect(card(page, BENCH).getByRole('listitem')).toHaveCount(1)
  })
})

test.describe('saving a workout as a template', () => {
  test('from the summary, with what was done', async ({ page }) => {
    await startWith(page, BENCH, ROW)
    await page.getByLabel('Workout title').fill('Heavy day')
    await page.getByLabel('Workout title').blur()
    await card(page, BENCH).getByRole('button', { name: 'Add set' }).click()
    await logSet(card(page, BENCH), 1, '80', '5')
    await logSet(card(page, BENCH), 2, '80', '5')
    await logSet(card(page, ROW), 1, '60', '10')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()

    await page.getByRole('button', { name: 'Save as template' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save as template' })
    await expect(dialog.getByLabel('Template name')).toHaveValue('Heavy day')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Template saved')).toBeVisible()
    await page.getByRole('button', { name: 'View' }).click()

    await expect(page).toHaveURL(/\/templates$/)
    const item = page.getByRole('listitem').filter({ hasText: 'Heavy day' })
    await expect(item).toContainText(`2 exercises · ${BENCH}, ${ROW}`)
    await item.getByRole('link').click()
    await expect(exerciseSection(page, BENCH).getByLabel('Sets')).toHaveValue(
      '2',
    )
    await expect(exerciseSection(page, BENCH).getByLabel('Reps')).toHaveValue(
      '5',
    )
    await expect(exerciseSection(page, ROW).getByLabel('Sets')).toHaveValue('1')
    await expect(exerciseSection(page, ROW).getByLabel('Reps')).toHaveValue(
      '10',
    )
  })

  test('from a workout in history', async ({ page }) => {
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('link', { name: 'History' }).click()
    await page
      .getByRole('link', { name: /Workout/ })
      .first()
      .click()

    await page.getByRole('button', { name: 'Save as template' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save as template' })
    await dialog.getByLabel('Template name').fill('From history')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Template saved')).toBeVisible()

    await page.goto('templates')
    await expect(
      page.getByRole('listitem').filter({ hasText: 'From history' }),
    ).toBeVisible()
  })

  test('asks for a name', async ({ page }) => {
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Save as template' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save as template' })
    await dialog.getByLabel('Template name').fill('   ')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByRole('alert')).toHaveText(
      'Template name is required',
    )
  })
})
