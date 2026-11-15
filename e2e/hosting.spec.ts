import { expect, test } from '@playwright/test'

// What GitHub Pages does that a typical dev server hides. These run against
// scripts/serve-pages.mjs, which behaves like Pages: a path prefix, real 404s
// and no index fallback.
const BASE = '/workout-tracker-pwa/'

const heading = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('heading', { name, level: 1 })

test.describe('GitHub Pages hosting', () => {
  test('answers an unknown path with a 404 that still carries the app', async ({
    request,
  }) => {
    const response = await request.get('history/some-workout')

    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('<div id="root">')
  })

  test('opens a deep link on the first visit despite the 404 status', async ({
    page,
  }) => {
    const response = await page.goto('history/some-workout')

    expect(response!.status()).toBe(404)
    await expect(heading(page, 'Workout')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Back', exact: true }),
    ).toBeVisible()
  })

  test('opens a deep link with no network after the service worker is ready', async ({
    page,
    context,
  }) => {
    await page.goto('exercises/new')
    await expect(heading(page, 'New exercise')).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()

    await context.setOffline(true)
    await page.reload()

    await expect(heading(page, 'New exercise')).toBeVisible()
  })

  test('sends every request to a path under the deployment prefix', async ({
    page,
  }) => {
    const outside: string[] = []
    page.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (!pathname.startsWith(BASE)) outside.push(pathname)
    })

    await page.goto('./')
    await expect(heading(page, 'Today')).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.goto('history')
    await page.goto('settings')
    await expect(heading(page, 'Settings')).toBeVisible()

    // A leaked absolute path such as /icons/x.png would land here: it works on
    // a dev server at the root and 404s once deployed under a prefix.
    expect(outside).toEqual([])
  })

  test('registers the service worker for the whole deployment prefix', async ({
    page,
  }) => {
    await page.goto('./')
    await expect(heading(page, 'Today')).toBeVisible()

    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready
      return { scope: new URL(ready.scope).pathname }
    })

    expect(registration.scope).toBe(BASE)
  })

  test('redirects the bare prefix to its trailing-slash address', async ({
    request,
  }) => {
    const response = await request.get('/workout-tracker-pwa', {
      maxRedirects: 0,
    })

    expect(response.status()).toBe(301)
    expect(response.headers()['location']).toBe(BASE)
  })
})
