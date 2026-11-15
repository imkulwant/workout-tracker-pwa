import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  BENCH,
  card,
  enter,
  logSet,
  putSetting,
  seedFinishedWorkouts,
  startWith,
  weight,
} from './helpers.ts'

const DAY = 86_400_000
const banner = (page: Page) =>
  page.getByRole('link', { name: /Back up your workouts/ })

async function downloadOnly(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    })
  })
}

test.describe('backup reminder', () => {
  test('stays away until there is a completed workout', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await expect(banner(page)).toHaveCount(0)

    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(banner(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await expect(banner(page)).toBeVisible()
    await expect(banner(page)).toContainText('never saved a backup')
  })

  test('goes away once a backup is saved, and links to Settings', async ({
    page,
  }) => {
    await downloadOnly(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 1)
    await page.reload()
    await expect(banner(page)).toBeVisible()

    await banner(page).click()
    await expect(page).toHaveURL(/\/settings$/)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save backup' }).click()
    await download

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await expect(banner(page)).toHaveCount(0)
  })

  test('appears when the last backup is more than 14 days old', async ({
    page,
  }) => {
    await page.goto('./')
    await seedFinishedWorkouts(page, 1)
    await putSetting(page, 'lastBackupAt', Date.now() - 13 * DAY)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await expect(banner(page)).toHaveCount(0)

    await putSetting(page, 'lastBackupAt', Date.now() - 15 * DAY)
    await page.reload()
    await expect(banner(page)).toContainText('15 days ago')
  })
})

test.describe('lost data', () => {
  async function loseEverything(page: Page) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase('gym-tracker')
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
          request.onblocked = () => reject(new Error('blocked'))
        }),
    )
  }

  async function savedBackup(page: Page) {
    await downloadOnly(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 2)
    // Reloading is what lets the app notice there is data worth guarding.
    await page.reload()
    await page.goto('settings')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save backup' }).click()
    const path = await (await download).path()
    return readFile(path, 'utf8')
  }

  test('offers a restore, and brings the workouts back from a backup', async ({
    page,
  }) => {
    const text = await savedBackup(page)
    await loseEverything(page)
    await page.goto('./')

    await expect(
      page.getByRole('heading', { name: 'Your workouts are missing' }),
    ).toBeVisible()
    await page.getByLabel('Backup file').setInputFiles({
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    })
    await page
      .getByRole('dialog', { name: 'Import backup' })
      .getByRole('button', { name: 'Replace everything' })
      .click()
    await page
      .getByRole('dialog', { name: 'Replace everything?' })
      .getByRole('button', { name: 'Replace', exact: true })
      .click()

    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await page.goto('history')
    await expect(page.getByRole('link', { name: /^Seeded/ })).toHaveCount(2)
  })

  test('lets you start with no data on purpose', async ({ page }) => {
    await savedBackup(page)
    await loseEverything(page)
    await page.goto('./')
    await page.getByRole('button', { name: 'Start with no data' }).click()

    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await page.goto('exercises')
    await expect(page.getByText('46 exercises')).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Your workouts are missing' }),
    ).toHaveCount(0)
  })

  test('does not offer a restore after deleting every workout on purpose', async ({
    page,
  }) => {
    await page.goto('./')
    await seedFinishedWorkouts(page, 1)
    await page.reload()
    await page.goto('history/seeded-w-0')
    await page.getByRole('button', { name: 'Delete workout' }).click()
    await page
      .getByRole('dialog', { name: 'Delete this workout?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page.getByText('No workouts yet')).toBeVisible()

    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  })
})

test.describe('a write the device refuses', () => {
  test('blocks the app with a message and a way to export, instead of looking saved', async ({
    page,
  }) => {
    await downloadOnly(page)
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args) {
        if ((window as unknown as { __full?: boolean }).__full) {
          throw new DOMException('Out of space', 'QuotaExceededError')
        }
        return put.apply(this, args)
      }
    })
    await startWith(page, BENCH)
    await page.evaluate(() => {
      ;(window as unknown as { __full: boolean }).__full = true
    })

    await enter(weight(card(page, BENCH), 1), '100')

    const dialog = page.getByRole('dialog', {
      name: 'Could not save to this device',
    })
    await expect(dialog).toBeVisible()
    await expect(card(page, BENCH)).toContainText('Could not save')

    await page.evaluate(() => {
      ;(window as unknown as { __full: boolean }).__full = false
    })
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Export backup' }).click()
    expect((await download).suggestedFilename()).toMatch(/\.json$/)
    await expect(dialog).toBeVisible()
  })
})
