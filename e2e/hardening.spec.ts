import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { generateTraining } from '../src/dev/generateTraining.ts'
import {
  BENCH,
  card,
  fixToday,
  logSet,
  seedFinishedWorkouts,
  seedGenerated,
  startWith,
} from './helpers.ts'

const TRAINING = generateTraining({ endDate: '2026-11-11', seed: 7 })

test.describe('no request leaves the origin', () => {
  test('across every screen and every feature that can reach out', async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin
    const foreign: string[] = []
    page.context().on('request', (request) => {
      const url = new URL(request.url())
      if (['data:', 'blob:', 'about:'].includes(url.protocol)) return
      if (url.origin !== origin) foreign.push(request.url())
    })
    // Kept outside the page, so it survives every navigation.
    const blocked: string[] = []
    await page.exposeFunction('__blocked', (what: string) => {
      blocked.push(what)
    })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
      })
      // The policy blocks a foreign request before it is sent, so an attempt
      // shows up as a violation and never as a request.
      document.addEventListener('securitypolicyviolation', (event) => {
        void (window as unknown as { __blocked(url: string): void }).__blocked(
          `${event.violatedDirective} ${event.blockedURI}`,
        )
      })
    })

    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 2)
    await seedGenerated(page, TRAINING)
    for (const path of [
      'history',
      'history/seeded-w-0',
      'stats',
      'exercises',
      'exercises/seed-barbell-bench-press',
      'exercises/new',
      'templates',
      'templates/new',
      'settings',
    ]) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
    }

    // Logging, finishing, saving a template, and the backup and CSV exports.
    await page.goto('./')
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Save as template' }).click()
    await page
      .getByRole('dialog', { name: 'Save as template' })
      .getByRole('button', { name: 'Save' })
      .click()
    await expect(page.getByText('Template saved')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto('settings')
    for (const button of ['Save backup', 'Export sets as CSV']) {
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: button }).click()
      await download
    }
    await page.goto('./')
    await page.waitForTimeout(500)

    expect(foreign).toEqual([])
    expect(blocked).toEqual([])
  })

  test('the page declares no third-party origin in its policy', async ({
    page,
  }) => {
    await page.goto('./')
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')
    expect(policy).not.toMatch(/https?:\/\//)
    expect(policy).toContain("default-src 'self'")
  })
})

test.describe('errors and states', () => {
  test('a screen that cannot be drawn shows a way out, not a blank page', async ({
    page,
  }) => {
    const logged: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') logged.push(message.text())
    })
    await page.goto('./')
    await seedFinishedWorkouts(page, 2)
    // A damaged row: a date that is not a date.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('gym-tracker')
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const tx = open.result.transaction('workouts', 'readwrite')
            const store = tx.objectStore('workouts')
            const get = store.get('seeded-w-0')
            get.onsuccess = () => store.put({ ...get.result, date: 'garbage' })
            tx.oncomplete = () => {
              open.result.close()
              resolve()
            }
          }
        }),
    )
    await page.goto('history')

    await expect(
      page.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
    expect(logged.join('\n')).toContain('The app failed to draw a screen.')

    // The data is still there to save.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
      })
    })
    await page.reload()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export backup' }).click()
    const file = await download
    const backup = JSON.parse(await readFile((await file.path())!, 'utf8'))
    expect(backup.data.workouts).toHaveLength(2)
  })

  test('every screen draws without a console error or a page error', async ({
    page,
  }) => {
    const problems: string[] = []
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
    page.on('pageerror', (e) => problems.push(String(e)))
    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 2)
    await seedGenerated(page, TRAINING)
    for (const path of [
      './',
      'history',
      'history/seeded-w-0',
      'history/missing',
      'stats',
      'exercises',
      'exercises/missing',
      'exercises/seed-barbell-bench-press/edit',
      'templates',
      'templates/missing',
      'settings',
      'workout',
      'nowhere',
    ]) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
    }
    expect(problems).toEqual([])
  })

  test('shows its empty states on a fresh install', async ({ page }) => {
    const empty: [string, string][] = [
      ['history', 'No workouts yet'],
      ['templates', 'No templates yet'],
      ['workout', 'No workout in progress'],
      ['history/missing', 'Workout not found'],
      ['exercises/missing', 'Exercise not found'],
      ['templates/missing', 'Template not found'],
      ['nowhere', 'There is nothing here'],
    ]
    for (const [path, text] of empty) {
      await page.goto(path)
      await expect(page.getByText(text), path).toBeVisible()
    }
  })
})
