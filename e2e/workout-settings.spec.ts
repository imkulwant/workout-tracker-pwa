import { expect, test, type Page } from '@playwright/test'
import { BENCH, startWith } from './helpers.ts'

interface LockLog {
  requested: number
  released: number
}

/** Gives the page a wake lock that records what is asked of it. */
async function fakeWakeLock(page: Page) {
  await page.addInitScript(() => {
    const log = { requested: 0, released: 0 }
    Object.assign(window, { __lockLog: log })
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request() {
          log.requested++
          const sentinel = {
            released: false,
            release() {
              sentinel.released = true
              log.released++
              return Promise.resolve()
            },
            addEventListener() {},
          }
          return Promise.resolve(sentinel)
        },
      },
    })
  })
}
const lockLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __lockLog: LockLog }).__lockLog)

const keepOn = (page: Page) =>
  page.getByRole('switch', { name: /^Keep screen on/ })
const restSound = (page: Page) =>
  page.getByRole('switch', { name: /^Rest sound/ })

test.describe('workout settings', () => {
  test('both switches start on, and keep a change after a reload', async ({
    page,
  }) => {
    await fakeWakeLock(page)
    await page.goto('settings')
    await expect(keepOn(page)).toHaveAttribute('aria-checked', 'true')
    await expect(restSound(page)).toHaveAttribute('aria-checked', 'true')

    await keepOn(page).click()
    await restSound(page).click()
    await expect(keepOn(page)).toHaveAttribute('aria-checked', 'false')
    await expect(restSound(page)).toHaveAttribute('aria-checked', 'false')

    await page.reload()
    await expect(keepOn(page)).toHaveAttribute('aria-checked', 'false')
    await expect(restSound(page)).toHaveAttribute('aria-checked', 'false')
  })

  test('holds the screen on during a workout and lets go when it is left', async ({
    page,
  }) => {
    await fakeWakeLock(page)
    await startWith(page, BENCH)
    await expect.poll(async () => (await lockLog(page)).requested).toBe(1)
    expect((await lockLog(page)).released).toBe(0)

    await page.goBack()
    await expect.poll(async () => (await lockLog(page)).released).toBe(1)
  })

  test('does not hold the screen on when Keep screen on is off', async ({
    page,
  }) => {
    await fakeWakeLock(page)
    await page.goto('settings')
    await keepOn(page).click()
    await expect(keepOn(page)).toHaveAttribute('aria-checked', 'false')

    await startWith(page, BENCH)
    // A request would come straight after the workout opens.
    await page.waitForTimeout(500)
    expect((await lockLog(page)).requested).toBe(0)
  })
})
