import { expect, test } from '@playwright/test'

const heading = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('heading', { name, level: 1 })

test.describe('manifest and head', () => {
  test('serves a manifest with the fields iOS honours', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.ok()).toBe(true)

    const manifest = await response.json()

    expect(manifest).toMatchObject({
      id: '/',
      name: 'Gym Tracker',
      short_name: 'Gym',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#0B0D10',
    })
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      ]),
    )
    // iOS ignores these, so nothing may depend on them.
    expect(manifest).not.toHaveProperty('orientation')
    expect(manifest).not.toHaveProperty('shortcuts')
  })

  test('links the manifest once, the touch icon and the startup images', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/icons/apple-touch-icon-180.png',
    )
    await expect(
      page.locator('link[rel="apple-touch-startup-image"]'),
    ).toHaveCount(8)
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]'),
    ).toHaveAttribute('content', 'yes')
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute('content', 'black-translucent')
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /viewport-fit=cover/,
    )
  })

  test('serves every icon the head and manifest point at', async ({
    request,
  }) => {
    for (const path of [
      '/icons/apple-touch-icon-180.png',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/startup-1206x2622.png',
      '/favicon.svg',
    ]) {
      const response = await request.get(path)
      expect(response.ok(), path).toBe(true)
      expect(response.headers()['content-type'], path).toMatch(/^image\//)
    }
  })
})

test.describe('offline', () => {
  test('launches and navigates with no network after the first visit', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(heading(page, 'Today')).toBeVisible()
    // Wait for the service worker to finish precaching, then reload so it
    // controls the page, as it does on every launch after the first.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect(heading(page, 'Today')).toBeVisible()
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller !== null),
    ).toBe(true)

    await context.setOffline(true)

    await page.reload()
    await expect(heading(page, 'Today')).toBeVisible()
    await page.goto('/history')
    await expect(heading(page, 'History')).toBeVisible()
    await page.goto('/exercises/new')
    await expect(heading(page, 'New exercise')).toBeVisible()
  })
})
