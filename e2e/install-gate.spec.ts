import { expect, test as browserTab } from '@playwright/test'
import { test as installed } from './fixtures.ts'

browserTab.describe('in a Safari tab', () => {
  browserTab('shows the install guide instead of the app', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'Install Gym Tracker', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Add to Home Screen')).toBeVisible()
    await expect(page.getByText('Open as Web App')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  })

  browserTab('turns logging off on every address', async ({ page }) => {
    for (const path of ['/workout', '/history/some-workout', '/settings']) {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { name: 'Install Gym Tracker' }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
    }
  })

  browserTab('never opens or seeds the database', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Install Gym Tracker' }),
    ).toBeVisible()
    await page.waitForTimeout(500)

    const names = await page.evaluate(async () =>
      (await indexedDB.databases()).map((db) => db.name),
    )

    expect(names).not.toContain('gym-tracker')
  })

  browserTab(
    'cannot be bypassed with ?browser in a production build',
    async ({ page }) => {
      await page.goto('/?browser')

      await expect(
        page.getByRole('heading', { name: 'Install Gym Tracker' }),
      ).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(
        0,
      )
    },
  )
})

installed.describe('from the Home Screen', () => {
  installed('opens the app instead of the guide', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'Today', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Install Gym Tracker' }),
    ).toHaveCount(0)
  })
})
