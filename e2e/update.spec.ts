import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { BENCH, card, logSet, startWith } from './helpers.ts'

type FakeSw = {
  messages: unknown[]
  makeWaiting(): void
  controllerChange(): void
}

/**
 * Replaces the browser's service worker container with one the test drives, so
 * a "new version" can appear at an exact moment. The registration the app
 * script asks for is accepted and ignored.
 */
async function fakeServiceWorker(page: Page) {
  await page.addInitScript(() => {
    const registrationHandlers: (() => void)[] = []
    const containerHandlers: (() => void)[] = []
    const messages: unknown[] = []
    const registration = {
      waiting: null as unknown,
      installing: null as unknown,
      addEventListener: (_t: string, l: () => void) =>
        registrationHandlers.push(l),
      update: () => Promise.resolve(),
    }
    const container = {
      controller: {},
      ready: Promise.resolve(registration),
      register: () => Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration),
      addEventListener: (_t: string, l: () => void) =>
        containerHandlers.push(l),
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: container,
    })
    const api: FakeSw = {
      messages,
      makeWaiting() {
        const stateHandlers: (() => void)[] = []
        const worker = {
          state: 'installing',
          postMessage: (m: unknown) => messages.push(m),
          addEventListener: (_t: string, l: () => void) =>
            stateHandlers.push(l),
        }
        registration.installing = worker
        registrationHandlers.forEach((h) => h())
        worker.state = 'installed'
        registration.waiting = worker
        stateHandlers.forEach((h) => h())
      },
      controllerChange: () => containerHandlers.forEach((h) => h()),
    }
    Object.assign(window, { __sw: api })
  })
}

const sw = (page: Page) => ({
  makeWaiting: () =>
    page.evaluate(() =>
      (window as unknown as { __sw: FakeSw }).__sw.makeWaiting(),
    ),
  controllerChange: () =>
    page.evaluate(() =>
      (window as unknown as { __sw: FakeSw }).__sw.controllerChange(),
    ),
  messages: () =>
    page.evaluate(() => (window as unknown as { __sw: FakeSw }).__sw.messages),
})

const banner = (page: Page) => page.getByRole('region', { name: 'Update' })

test.describe('update prompt', () => {
  test('appears on Today when a new version is waiting', async ({ page }) => {
    await fakeServiceWorker(page)
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await expect(banner(page)).toHaveCount(0)

    await sw(page).makeWaiting()

    await expect(banner(page)).toContainText('A new version is ready')
    await expect(
      banner(page).getByRole('button', { name: 'Update' }),
    ).toBeVisible()
  })

  test('also appears in Settings, next to the version', async ({ page }) => {
    await fakeServiceWorker(page)
    await page.goto('settings')
    await expect(page.getByText('Version 1.0.0')).toBeVisible()
    await sw(page).makeWaiting()
    await expect(banner(page)).toBeVisible()
  })

  test('is not offered during a workout, and appears once it is finished', async ({
    page,
  }) => {
    await fakeServiceWorker(page)
    await startWith(page, BENCH)
    await sw(page).makeWaiting()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
    await expect(banner(page)).toHaveCount(0)

    await page.getByRole('link', { name: 'Resume workout' }).click()
    await logSet(card(page, BENCH), 1, '60', '8')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await expect(banner(page)).toBeVisible()
  })

  test('does nothing until Update is tapped, then switches and reloads', async ({
    page,
  }) => {
    await fakeServiceWorker(page)
    await page.goto('./')
    await sw(page).makeWaiting()
    await expect(banner(page)).toBeVisible()
    await page.evaluate(() => Object.assign(window, { __before: true }))

    // A switch nobody asked for does not reload the page.
    await sw(page).controllerChange()
    await page.waitForTimeout(300)
    expect(await sw(page).messages()).toEqual([])
    expect(
      await page.evaluate(
        () => (window as unknown as { __before?: true }).__before,
      ),
    ).toBe(true)

    await banner(page).getByRole('button', { name: 'Update' }).click()
    await expect
      .poll(() => sw(page).messages())
      .toEqual([{ type: 'SKIP_WAITING' }])
    expect(
      await page.evaluate(
        () => (window as unknown as { __before?: true }).__before,
      ),
    ).toBe(true)

    await Promise.all([page.waitForEvent('load'), sw(page).controllerChange()])
    expect(
      await page.evaluate(
        () => (window as unknown as { __before?: true }).__before,
      ),
    ).toBeUndefined()
  })

  test('a workout in progress is never reloaded by a switch from elsewhere', async ({
    page,
  }) => {
    await fakeServiceWorker(page)
    await startWith(page, BENCH)
    await sw(page).makeWaiting()
    await page.evaluate(() => Object.assign(window, { __before: true }))

    await sw(page).controllerChange()
    await page.waitForTimeout(300)

    expect(
      await page.evaluate(
        () => (window as unknown as { __before?: true }).__before,
      ),
    ).toBe(true)
    await expect(card(page, BENCH)).toBeVisible()
  })
})

test.describe('update with the real service worker', () => {
  test('finds a changed build, waits, and switches only when asked', async ({
    page,
  }) => {
    const file = `${process.cwd()}/dist/sw.js`
    const original = await readFile(file, 'utf8')
    try {
      await page.goto('./')
      await page.evaluate(() => navigator.serviceWorker.ready)
      // The first visit is not controlled yet. A reload is.
      await page.reload()
      await expect
        .poll(() =>
          page.evaluate(() => navigator.serviceWorker.controller !== null),
        )
        .toBe(true)
      await expect(banner(page)).toHaveCount(0)

      // A new build: the same worker with one more line, so the bytes differ.
      await writeFile(file, `${original}\n// update test ${Date.now()}\n`)
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration!.update()
      })

      await expect(banner(page)).toBeVisible({ timeout: 15_000 })
      expect(
        await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          return registration!.waiting !== null
        }),
      ).toBe(true)

      await Promise.all([
        page.waitForEvent('load'),
        banner(page).getByRole('button', { name: 'Update' }).click(),
      ])
      await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
      await expect(banner(page)).toHaveCount(0)
      expect(
        await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          return registration!.waiting
        }),
      ).toBeNull()
    } finally {
      await writeFile(file, original)
    }
  })
})
