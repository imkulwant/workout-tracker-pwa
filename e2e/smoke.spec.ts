import { expect, test } from '@playwright/test'

test('the built app loads in iPhone WebKit', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Gym Tracker' })).toBeVisible()
})
