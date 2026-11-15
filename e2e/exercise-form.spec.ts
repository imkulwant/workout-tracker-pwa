import { expect, test, type Page } from '@playwright/test'

const list = (page: Page) => page.getByRole('list', { name: 'Exercise list' })
const rows = (page: Page) => list(page).getByRole('listitem')
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, level: 1 })
const group = (page: Page, name: string) => page.getByRole('group', { name })
const muscle = (page: Page, groupName: string, name: string) =>
  group(page, groupName).getByRole('button', { name, exact: true })
const nameField = (page: Page) => page.getByLabel('Name', { exact: true })
const save = (page: Page) => page.getByRole('button', { name: 'Save exercise' })

/** Fills the new-exercise form and saves, through the real UI. */
async function createThroughForm(
  page: Page,
  name: string,
  primary: string[],
  secondary: string[] = [],
) {
  await page.goto('exercises/new')
  await nameField(page).fill(name)
  for (const m of primary) await muscle(page, 'Primary muscles', m).click()
  for (const m of secondary) await muscle(page, 'Secondary muscles', m).click()
  await save(page).click()
  await expect(heading(page, 'Exercises')).toBeVisible()
}

test.describe('create an exercise', () => {
  test('adds it from the library and lists it there', async ({ page }) => {
    await page.goto('exercises')
    await page.getByRole('link', { name: 'Add', exact: true }).click()
    await expect(heading(page, 'New exercise')).toBeVisible()

    await nameField(page).fill('Landmine Press')
    await page.getByLabel('Equipment').selectOption('barbell')
    await muscle(page, 'Primary muscles', 'Front delts').click()
    await muscle(page, 'Secondary muscles', 'Triceps').click()
    await save(page).click()

    await expect(heading(page, 'Exercises')).toBeVisible()
    await expect(page).toHaveURL(/exercises$/)
    await expect(rows(page)).toHaveCount(47)
    await expect(
      rows(page).filter({ hasText: 'Landmine Press' }),
    ).toContainText('Barbell · Front delts')
  })

  test('creates it from a deep link and returns to the library', async ({
    page,
  }) => {
    await createThroughForm(page, 'Cable Pullover', ['Lats'])

    await expect(page).toHaveURL(/exercises$/)
    await expect(rows(page).filter({ hasText: 'Cable Pullover' })).toHaveCount(
      1,
    )
  })

  test('stores the choices and shows them on the detail screen', async ({
    page,
  }) => {
    await page.goto('exercises/new')
    await nameField(page).fill('Sled Push')
    await page.getByLabel('Equipment').selectOption('other')
    await page.getByLabel('Load type').selectOption('bodyweight_reps')
    await muscle(page, 'Primary muscles', 'Quads').click()
    await muscle(page, 'Primary muscles', 'Glutes').click()
    await muscle(page, 'Secondary muscles', 'Calves').click()
    await page.getByLabel('Default rest (optional)').fill('75')
    await page.getByLabel('Weight increment').fill('2,5')
    await page.getByLabel('Notes').fill('keep hips low')
    await save(page).click()

    await rows(page).filter({ hasText: 'Sled Push' }).getByRole('link').click()

    await expect(heading(page, 'Sled Push')).toBeVisible()
    const detail = page.getByRole('definition')
    await expect(detail).toContainText([
      'Other',
      'Bodyweight reps',
      'Quads, Glutes',
      'Calves',
      '75 s',
      '2.5 kg',
      'keep hips low',
    ])
  })

  test('pre-fills the name when you add from a search with no hits', async ({
    page,
  }) => {
    await page.goto('exercises')
    await page
      .getByRole('searchbox', { name: 'Search exercises' })
      .fill('zercher squat')

    await page.getByRole('link', { name: 'Add it as a new exercise' }).click()

    await expect(nameField(page)).toHaveValue('zercher squat')
  })
})

test.describe('exercise form validation', () => {
  test('shows each problem next to its field, and saves nothing', async ({
    page,
  }) => {
    await page.goto('exercises/new')
    await page.getByLabel('Weight increment').fill('0')
    await page.getByLabel('Default rest (optional)').fill('90,5')

    await save(page).click()

    await expect(page.getByText('Enter a name.')).toBeVisible()
    await expect(
      page.getByText('An exercise needs at least one primary muscle.'),
    ).toBeVisible()
    await expect(page.getByText(/Enter whole seconds/)).toBeVisible()
    await expect(page.getByText(/Enter a number above 0/)).toBeVisible()
    await expect(heading(page, 'New exercise')).toBeVisible()

    await page.goto('exercises')
    await expect(rows(page)).toHaveCount(46)
  })

  test('rejects a muscle that is both primary and secondary, by name', async ({
    page,
  }) => {
    await page.goto('exercises/new')
    await nameField(page).fill('Odd Press')
    await muscle(page, 'Primary muscles', 'Chest').click()
    await muscle(page, 'Secondary muscles', 'Chest').click()

    await save(page).click()

    await expect(
      page.getByText('Chest cannot be both primary and secondary.'),
    ).toBeVisible()
    await expect(heading(page, 'New exercise')).toBeVisible()
  })

  test('toggles a muscle chip on and off', async ({ page }) => {
    await page.goto('exercises/new')
    const chest = muscle(page, 'Primary muscles', 'Chest')

    await chest.click()
    await expect(chest).toHaveAttribute('aria-pressed', 'true')
    await chest.click()
    await expect(chest).toHaveAttribute('aria-pressed', 'false')
  })

  test('rejects a name that exists, ignoring case, and keeps the form open', async ({
    page,
  }) => {
    await page.goto('exercises/new')
    await nameField(page).fill('  barbell BENCH press ')
    await muscle(page, 'Primary muscles', 'Chest').click()

    await save(page).click()

    await expect(
      page.getByText('An exercise named "Barbell Bench Press" already exists.'),
    ).toBeVisible()
    await expect(nameField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(heading(page, 'New exercise')).toBeVisible()
  })
})

test.describe('edit an exercise', () => {
  test('renames a built-in exercise, and the library and detail follow', async ({
    page,
  }) => {
    await page.goto('exercises/seed-hammer-curl')
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(heading(page, 'Edit exercise')).toBeVisible()
    await expect(nameField(page)).toHaveValue('Hammer Curl')

    await nameField(page).fill('Neutral Grip Curl')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(heading(page, 'Neutral Grip Curl')).toBeVisible()
    await page.goto('exercises')
    await expect(
      rows(page).filter({ hasText: 'Neutral Grip Curl' }),
    ).toHaveCount(1)
    await expect(rows(page).filter({ hasText: /^Hammer Curl/ })).toHaveCount(0)
  })

  test('keeps its own name, but not one that another exercise has', async ({
    page,
  }) => {
    await page.goto('exercises/seed-hammer-curl/edit')

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(heading(page, 'Hammer Curl')).toBeVisible()

    await page.goto('exercises/seed-hammer-curl/edit')
    await nameField(page).fill('cable curl')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByText('An exercise named "Cable Curl" already exists.'),
    ).toBeVisible()
  })

  test('loads the stored muscles into the chips', async ({ page }) => {
    await page.goto('exercises/seed-deadlift/edit')

    for (const m of ['Glutes', 'Hamstrings', 'Lower back']) {
      await expect(muscle(page, 'Primary muscles', m)).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    await expect(muscle(page, 'Secondary muscles', 'Quads')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(muscle(page, 'Primary muscles', 'Chest')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('says so for an exercise that does not exist', async ({ page }) => {
    for (const path of ['exercises/nope', 'exercises/nope/edit']) {
      await page.goto(path)
      await expect(page.getByText('Exercise not found')).toBeVisible()
    }
  })
})

test.describe('archive and restore', () => {
  const archiveDialog = (page: Page, name: string) =>
    page.getByRole('dialog', { name: `Archive ${name}?` })

  test('archives with a confirmation, hides it, and restores it', async ({
    page,
  }) => {
    await page.goto('exercises/seed-hammer-curl')
    await page.getByRole('button', { name: 'Archive' }).click()
    await expect(archiveDialog(page, 'Hammer Curl')).toBeVisible()
    await archiveDialog(page, 'Hammer Curl')
      .getByRole('button', { name: 'Archive' })
      .click()

    await expect(page.getByText(/Archived\. It is hidden/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()

    await page.goto('exercises')
    await expect(rows(page)).toHaveCount(45)
    await expect(rows(page).filter({ hasText: 'Hammer Curl' })).toHaveCount(0)

    await page
      .getByRole('group', { name: 'Filter by body part' })
      .getByRole('button', { name: 'Archived' })
      .click()
    await expect(rows(page)).toHaveCount(46)
    await expect(rows(page).filter({ hasText: 'Hammer Curl' })).toContainText(
      'Archived',
    )

    await rows(page)
      .filter({ hasText: 'Hammer Curl' })
      .getByRole('link')
      .click()
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()

    await page.goto('exercises')
    await expect(rows(page)).toHaveCount(46)
  })

  test('cancelling the confirmation changes nothing', async ({ page }) => {
    await page.goto('exercises/seed-hammer-curl')
    await page.getByRole('button', { name: 'Archive' }).click()

    await archiveDialog(page, 'Hammer Curl')
      .getByRole('button', { name: 'Cancel' })
      .click()

    await expect(archiveDialog(page, 'Hammer Curl')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()
    await page.goto('exercises')
    await expect(rows(page)).toHaveCount(46)
  })

  test('refuses to restore onto a name an active exercise now has', async ({
    page,
  }) => {
    await createThroughForm(page, 'Landmine Press', ['Front delts'])
    await rows(page)
      .filter({ hasText: 'Landmine Press' })
      .getByRole('link')
      .click()
    await page.getByRole('button', { name: 'Archive' }).click()
    await archiveDialog(page, 'Landmine Press')
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
    const archivedUrl = page.url()

    await createThroughForm(page, 'Landmine Press', ['Front delts'])
    await page.goto(archivedUrl)
    await page.getByRole('button', { name: 'Restore' }).click()

    await expect(
      page.getByText(
        'An exercise named "Landmine Press" already exists. Rename one of them first.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
  })
})
