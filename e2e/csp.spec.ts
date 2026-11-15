import { expect, test as browserTab, type Page } from '@playwright/test'
import { test as installed } from './fixtures.ts'

type CspWindow = { __csp: string[] }

/** Records every Content-Security-Policy violation the page reports. */
async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const violations: string[] = []
    ;(window as unknown as CspWindow).__csp = violations
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as CspWindow).__csp)

installed.describe('Content-Security-Policy', () => {
  installed('is sent on the page and on deep links', async ({ page }) => {
    for (const path of ['/', '/history/some-workout']) {
      const response = await page.goto(path)
      const headers = response!.headers()

      expect(headers['content-security-policy'], path).toContain(
        "script-src 'self'",
      )
      expect(headers['content-security-policy'], path).toContain(
        "object-src 'none'",
      )
      expect(headers['x-content-type-options'], path).toBe('nosniff')
    }
  })

  installed(
    'is enforced: an injected inline script is blocked',
    async ({ page }) => {
      await watchViolations(page)
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Today', level: 1 }),
      ).toBeVisible()

      const ran = await page.evaluate(() => {
        const script = document.createElement('script')
        script.textContent = 'window.__injected = true'
        document.head.append(script)
        return (
          (window as unknown as { __injected?: boolean }).__injected === true
        )
      })

      expect(ran).toBe(false)
      await expect
        .poll(() => violations(page))
        .toEqual([expect.stringContaining('script-src')])
    },
  )

  installed(
    'runs the whole app, service worker included, without a violation',
    async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      await watchViolations(page)

      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Today', level: 1 }),
      ).toBeVisible()
      await page.evaluate(() => navigator.serviceWorker.ready)
      for (const path of [
        '/history',
        '/stats',
        '/exercises',
        '/settings',
        '/workout',
      ]) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      }
      await page.reload()

      expect(await violations(page)).toEqual([])
      expect(consoleErrors).toEqual([])
    },
  )
})

browserTab('shows the install guide without a violation', async ({ page }) => {
  await watchViolations(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Install Gym Tracker' }),
  ).toBeVisible()
  // The guide shows an icon, which img-src must allow.
  await expect(page.locator('img')).toHaveJSProperty('complete', true)

  expect(await violations(page)).toEqual([])
})
