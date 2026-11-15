import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'

/**
 * Playwright's WebKit is a browser tab, never a Home Screen app, so the
 * install gate would hide the app. Tests that need the app itself use this
 * `test`, which reports Home Screen mode the way iOS does. Tests of the gate
 * use Playwright's own `test` instead.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', {
        value: true,
        configurable: true,
      })
    })
    await provide(page)
  },
})
