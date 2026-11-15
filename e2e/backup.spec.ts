import { readFile } from 'node:fs/promises'
import { expect, test, type Download, type Page } from '@playwright/test'
import {
  BENCH,
  card,
  logSet,
  seedFinishedWorkouts,
  startWith,
} from './helpers.ts'

/** Makes the browser download files instead of opening a share sheet. */
async function downloadOnly(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    })
  })
}

async function saveBackup(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const file = await download
  return { file, name: file.suggestedFilename() }
}

async function readDownload(file: Download) {
  const path = await file.path()
  return readFile(path, 'utf8')
}

async function chooseBackup(page: Page, name: string, content: string) {
  await page.getByLabel('Backup file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  })
}

const rows = (page: Page) => page.getByRole('link', { name: /^Seeded/ })

test.describe('backup', () => {
  test('saves a backup file named for today and records the date', async ({
    page,
  }) => {
    await downloadOnly(page)
    await page.goto('settings')
    await expect(page.getByText('Never backed up')).toBeVisible()

    const { file, name } = await saveBackup(page)
    expect(name).toMatch(/^workout-tracker-\d{4}-\d{2}-\d{2}\.json$/)
    const backup = JSON.parse(await readDownload(file))
    expect(backup).toMatchObject({
      format: 'workout-tracker-backup',
      schemaVersion: 1,
    })
    expect(backup.data.exercises.length).toBeGreaterThan(40)

    await expect(page.locator('p[role="status"]')).toHaveText('Backup saved.')
    await expect(page.getByText(/^Last backup \d+ \w+ \d{4}$/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/^Last backup /)).toBeVisible()
  })

  test('exports completed sets as CSV', async ({ page }) => {
    await downloadOnly(page)
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '82,5', '5')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto('settings')

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export sets as CSV' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^workout-tracker-sets-.*\.csv$/)
    const lines = (await readDownload(file)).split('\r\n')
    expect(lines[0]).toBe('date,workout,exercise,set,type,kg,reps')
    expect(lines[1]).toMatch(
      /^\d{4}-\d{2}-\d{2},Workout,Barbell Bench Press,1,working,82\.5,5$/,
    )
    await expect(page.getByText(/^Never backed up$/)).toBeVisible()
  })

  test('asks for another tap when the share sheet is blocked', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let calls = 0
      const shared: string[] = []
      Object.assign(window, { __shared: shared })
      Object.defineProperty(navigator, 'canShare', {
        value: () => true,
        configurable: true,
      })
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { files: File[] }) => {
          calls++
          if (calls === 1) {
            throw Object.assign(new Error('no tap'), {
              name: 'NotAllowedError',
            })
          }
          shared.push(data.files[0]!.name)
        },
      })
    })
    await page.goto('settings')
    await page.getByRole('button', { name: 'Save backup' }).click()
    await expect(page.locator('p[role="status"]')).toContainText(
      'Tap Save file',
    )
    await expect(page.getByText('Never backed up')).toBeVisible()

    await page.getByRole('button', { name: 'Save file' }).click()
    await expect(page.locator('p[role="status"]')).toHaveText('Backup saved.')
    await expect(page.getByRole('button', { name: 'Save file' })).toHaveCount(0)
    const shared = await page.evaluate(
      () => (window as unknown as { __shared: string[] }).__shared,
    )
    expect(shared).toHaveLength(1)
    expect(shared[0]).toMatch(/^workout-tracker-.*\.json$/)
  })
})

test.describe('restore', () => {
  /** Seeds three workouts, saves a backup, then changes the data. */
  async function backupThenChange(page: Page) {
    await downloadOnly(page)
    await page.addInitScript(() => {
      const found: string[] = []
      Object.assign(window, { __csp: found })
      document.addEventListener('securitypolicyviolation', (event) => {
        found.push(`${event.violatedDirective} ${event.blockedURI}`)
      })
    })
    await page.goto('./')
    await seedFinishedWorkouts(page, 3)
    await page.goto('settings')
    const { file } = await saveBackup(page)
    const text = await readDownload(file)

    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByLabel('Workout title').fill('Added later')
    await page.getByLabel('Workout title').blur()
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto('history')
    await expect(page.getByRole('link', { name: /Added later/ })).toBeVisible()
    return text
  }

  test('replace brings the data back to the backup', async ({ page }) => {
    const text = await backupThenChange(page)
    await page.goto('settings')
    await chooseBackup(page, 'b.json', text)

    const sheet = page.getByRole('dialog', { name: 'Import backup' })
    await expect(sheet.getByText('Workouts', { exact: true })).toBeVisible()
    await expect(sheet).toContainText('Workouts from')
    await sheet.getByRole('button', { name: 'Replace everything' }).click()
    await page
      .getByRole('dialog', { name: 'Replace everything?' })
      .getByRole('button', { name: 'Replace', exact: true })
      .click()
    await expect(page.getByText('Backup restored')).toBeVisible()

    // Reading a backup must not need anything the app's policy forbids.
    expect(
      await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      ),
    ).toEqual([])

    await page.goto('history')
    await expect(rows(page)).toHaveCount(3)
    await expect(page.getByRole('link', { name: /Added later/ })).toHaveCount(0)
  })

  test('merge keeps what was added since', async ({ page }) => {
    const text = await backupThenChange(page)
    await page.goto('settings')
    await chooseBackup(page, 'b.json', text)
    await page
      .getByRole('dialog', { name: 'Import backup' })
      .getByRole('button', { name: 'Merge with what is here' })
      .click()
    await expect(page.getByText(/^Merged: \d+ records/)).toBeVisible()

    await page.goto('history')
    await expect(rows(page)).toHaveCount(3)
    await expect(page.getByRole('link', { name: /Added later/ })).toBeVisible()
  })

  test('offers to save a copy before replacing', async ({ page }) => {
    const text = await backupThenChange(page)
    await page.goto('settings')
    await chooseBackup(page, 'b.json', text)
    await page
      .getByRole('dialog', { name: 'Import backup' })
      .getByRole('button', { name: 'Replace everything' })
      .click()
    const confirm = page.getByRole('dialog', { name: 'Replace everything?' })

    const download = page.waitForEvent('download')
    await confirm.getByRole('button', { name: 'Save a copy first' }).click()
    await download
    await expect(
      confirm.getByRole('button', { name: 'Copy saved' }),
    ).toBeVisible()
    await confirm.getByRole('button', { name: 'Cancel' }).click()

    await page.goto('history')
    await expect(page.getByRole('link', { name: /Added later/ })).toBeVisible()
  })

  test('cancelling the import changes nothing', async ({ page }) => {
    const text = await backupThenChange(page)
    await page.goto('settings')
    await chooseBackup(page, 'b.json', text)
    await page
      .getByRole('dialog', { name: 'Import backup' })
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page.goto('history')
    await expect(page.getByRole('link', { name: /Added later/ })).toBeVisible()
  })

  for (const [name, content] of [
    ['not JSON', 'hello, this is not a backup'],
    ['the wrong JSON', '{"format":"something-else"}'],
    [
      'a backup with a bad set',
      JSON.stringify({
        format: 'workout-tracker-backup',
        schemaVersion: 1,
        exportedAt: 1,
        appVersion: '1.0.0',
        data: {
          exercises: [],
          workouts: [],
          workoutExercises: [],
          sets: [{ id: 'x' }],
          templates: [],
          settings: [],
        },
      }),
    ],
  ] as const) {
    test(`rejects ${name} and changes nothing`, async ({ page }) => {
      await page.goto('./')
      await seedFinishedWorkouts(page, 2)
      await page.goto('settings')
      await chooseBackup(page, 'bad.json', content)

      await expect(page.getByRole('alert')).toContainText(
        'Nothing was changed.',
      )
      await expect(
        page.getByRole('dialog', { name: 'Import backup' }),
      ).toBeHidden()
      await page.goto('history')
      await expect(rows(page)).toHaveCount(2)
    })
  }
})
