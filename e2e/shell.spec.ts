import { expect, test, type Page } from '@playwright/test'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, level: 1 })

/** Counts the exercises in the app's real IndexedDB database. */
const exerciseCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('gym-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const request = db
            .transaction('exercises')
            .objectStore('exercises')
            .count()
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            db.close()
            resolve(request.result)
          }
        }
      }),
  )

test.describe('app shell', () => {
  test('opens on Today with the four tabs in order', async ({ page }) => {
    await page.goto('./')

    await expect(heading(page, 'Today')).toBeVisible()
    await expect(nav(page).getByRole('link')).toHaveText([
      'Today',
      'History',
      'Stats',
      'Exercises',
    ])
    await expect(
      nav(page).getByRole('link', { name: 'Today' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('switches screens from the tab bar and marks the active tab', async ({
    page,
  }) => {
    await page.goto('./')

    for (const tab of ['History', 'Stats', 'Exercises']) {
      await nav(page).getByRole('link', { name: tab }).click()
      await expect(heading(page, tab)).toBeVisible()
      await expect(nav(page).getByRole('link', { name: tab })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(
        nav(page).getByRole('link', { name: 'Today' }),
      ).not.toHaveAttribute('aria-current', 'page')
    }
  })

  test('keeps the Exercises tab active on its pushed screens', async ({
    page,
  }) => {
    await page.goto('exercises/new')

    await expect(heading(page, 'New exercise')).toBeVisible()
    await expect(
      nav(page).getByRole('link', { name: 'Exercises' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('opens a deep link directly, and Back falls back to the parent screen', async ({
    page,
  }) => {
    await page.goto('history/some-workout')
    await expect(heading(page, 'Workout')).toBeVisible()

    await page.getByRole('button', { name: 'Back', exact: true }).click()

    await expect(page).toHaveURL(/\/history$/)
    await expect(heading(page, 'History')).toBeVisible()
  })

  test('Back returns to the previous screen when there is one', async ({
    page,
  }) => {
    await page.goto('./')
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(heading(page, 'Settings')).toBeVisible()

    await page.getByRole('button', { name: 'Back', exact: true }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(heading(page, 'Today')).toBeVisible()
  })

  test('shows the active workout screen outside the tab bar', async ({
    page,
  }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'Start workout' }).click()

    await expect(page).toHaveURL(/\/workout$/)
    await expect(heading(page, 'Workout')).toBeVisible()
    await expect(nav(page)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Back', exact: true }),
    ).toBeVisible()
  })

  test('reaches Templates from Today', async ({ page }) => {
    await page.goto('./')

    await page.getByRole('link', { name: 'Templates' }).click()

    await expect(heading(page, 'Templates')).toBeVisible()
  })

  test('shows a not-found screen for an unknown address', async ({ page }) => {
    await page.goto('no/such/screen')

    await expect(heading(page, 'Not found')).toBeVisible()
    await page.getByRole('link', { name: 'Go to Today' }).click()
    await expect(heading(page, 'Today')).toBeVisible()
  })

  test('fades screens in well under 200 ms', async ({ page }) => {
    await page.goto('history')

    const duration = await page
      .locator('main > .screen-enter')
      .evaluate((el) => getComputedStyle(el).animationDuration)

    expect(parseFloat(duration) * 1000).toBeLessThan(200)
  })

  test('makes no request outside its own origin', async ({ page, baseURL }) => {
    const foreign: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL!).origin) {
        foreign.push(request.url())
      }
    })

    await page.goto('./')
    await nav(page).getByRole('link', { name: 'Stats' }).click()
    await page.goto('settings')
    await expect(heading(page, 'Settings')).toBeVisible()

    expect(foreign).toEqual([])
  })
})

test.describe('launch', () => {
  test('seeds the 46-exercise library into IndexedDB on first launch', async ({
    page,
  }) => {
    await page.goto('./')
    // The app renders only after boot finishes, so Today means seeding is done.
    await expect(heading(page, 'Today')).toBeVisible()

    expect(await exerciseCount(page)).toBe(46)
  })

  test('works directly in a browser tab, with no install page or prompt', async ({
    page,
  }) => {
    await page.goto('./')

    await expect(heading(page, 'Today')).toBeVisible()
    await expect(page.getByText(/add to home screen|install/i)).toHaveCount(0)
    expect(await exerciseCount(page)).toBe(46)
  })

  test('does not seed twice across reloads', async ({ page }) => {
    await page.goto('./')
    await expect(heading(page, 'Today')).toBeVisible()
    await page.reload()
    await expect(heading(page, 'Today')).toBeVisible()

    expect(await exerciseCount(page)).toBe(46)
  })

  test('reports the persistence result in Settings', async ({ page }) => {
    await page.goto('settings')

    const status = page.getByRole('region', { name: 'Persistent storage' })
    await expect(status).toBeVisible()
    await expect(status).toContainText(/Granted|Not granted|Unavailable/)
    await expect(status).not.toContainText('Checking')
  })
})
