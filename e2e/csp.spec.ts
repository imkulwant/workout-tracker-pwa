import { expect, test, type Page } from '@playwright/test'
import { CONTENT_SECURITY_POLICY } from '../csp.ts'

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

test.describe('Content-Security-Policy', () => {
  test('is delivered as a meta tag on the page and on a deep link', async ({
    page,
  }) => {
    for (const path of ['./', 'history/some-workout']) {
      await page.goto(path)

      await expect(
        page.locator('meta[http-equiv="Content-Security-Policy"]'),
        path,
      ).toHaveAttribute('content', CONTENT_SECURITY_POLICY)
      await expect(page.locator('meta[name="referrer"]'), path).toHaveAttribute(
        'content',
        'no-referrer',
      )
    }
  })

  test('is enforced: an injected inline script is blocked', async ({
    page,
  }) => {
    await watchViolations(page)
    await page.goto('./')
    await expect(
      page.getByRole('heading', { name: 'Today', level: 1 }),
    ).toBeVisible()

    const ran = await page.evaluate(() => {
      const script = document.createElement('script')
      script.textContent = 'window.__injected = true'
      document.head.append(script)
      return (window as unknown as { __injected?: boolean }).__injected === true
    })

    expect(ran).toBe(false)
    await expect
      .poll(() => violations(page))
      .toEqual([expect.stringContaining('script-src')])
  })

  test('runs the whole app, service worker included, without a violation', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await watchViolations(page)

    await page.goto('./')
    await expect(
      page.getByRole('heading', { name: 'Today', level: 1 }),
    ).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    for (const path of [
      'history',
      'stats',
      'exercises',
      'settings',
      'workout',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
    await page.reload()

    expect(await violations(page)).toEqual([])
    // Browsers log a console error for directives a meta policy cannot carry,
    // such as frame-ancestors, so this also proves none is present.
    expect(consoleErrors).toEqual([])
  })
})
