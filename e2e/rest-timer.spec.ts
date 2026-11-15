import { expect, test, type Page } from '@playwright/test'
import { BENCH, card, logSet, options, startWith } from './helpers.ts'

const bar = (page: Page) => page.getByRole('region', { name: 'Rest timer' })
const remaining = (page: Page) => bar(page).getByRole('timer')

/** Replaces the audio context with one that counts the beeps it is asked for. */
async function countBeeps(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __beeps: number }
    w.__beeps = 0
    class FakeContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() {
        return Promise.resolve()
      }
      createOscillator() {
        return {
          type: '',
          frequency: { value: 0 },
          connect() {},
          start() {
            w.__beeps++
          },
          stop() {},
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
          connect() {},
        }
      }
    }
    Object.assign(window, { AudioContext: FakeContext })
  })
}
const beeps = (page: Page) =>
  page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)

test.describe('rest timer', () => {
  test('starts after a working set and survives a reload', async ({ page }) => {
    await startWith(page, BENCH)
    await expect(bar(page)).toBeHidden()

    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(remaining(page)).toHaveText(/^(2:00|1:5\d)$/)
    await expect(bar(page)).toContainText(
      'Alerts do not fire while the app is in the background.',
    )

    await page.reload()
    await expect(remaining(page)).toHaveText(/^(2:00|1:5\d)$/)
  })

  test('adds and removes 15 seconds, and skips', async ({ page }) => {
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')

    await bar(page)
      .getByRole('button', { name: /^\+15 s/ })
      .click()
    await expect(remaining(page)).toHaveText(/^2:(1\d|0\d)$/)
    await bar(page)
      .getByRole('button', { name: /^−15 s/ })
      .click()
    await expect(remaining(page)).toHaveText(/^(2:00|1:5\d)$/)

    await bar(page).getByRole('button', { name: 'Skip' }).click()
    await expect(bar(page)).toBeHidden()
    await page.reload()
    await expect(bar(page)).toBeHidden()
  })

  test('does not start after a warm-up set', async ({ page }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await options(c, 1).click()
    await page
      .getByRole('dialog', { name: 'Set 1' })
      .getByRole('button', { name: 'Warm-up' })
      .click()

    await logSet(c, 1, '20', '10')
    // The timer would be stored just after the tick, so give it time to show.
    await page.waitForTimeout(500)
    await expect(bar(page)).toBeHidden()
  })

  test('plays the tone once when the rest ends while the app is open', async ({
    page,
  }) => {
    await countBeeps(page)
    await page.clock.install()
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(bar(page)).toBeVisible()

    await page.clock.runFor(120_500)
    await expect(bar(page)).toBeHidden()
    expect(await beeps(page)).toBe(2)
  })

  test('stays silent when Rest sound is off', async ({ page }) => {
    await countBeeps(page)
    await page.clock.install()
    await page.goto('settings')
    await page.getByRole('switch', { name: /^Rest sound/ }).click()
    await expect(
      page.getByRole('switch', { name: /^Rest sound/ }),
    ).toHaveAttribute('aria-checked', 'false')

    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(bar(page)).toBeVisible()
    await page.clock.runFor(120_500)
    await expect(bar(page)).toBeHidden()
    expect(await beeps(page)).toBe(0)
  })

  test('clears a rest that ended long ago without a tone', async ({ page }) => {
    await countBeeps(page)
    await page.clock.install()
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(bar(page)).toBeVisible()

    await page.clock.fastForward(600_000)
    await expect(bar(page)).toBeHidden()
    expect(await beeps(page)).toBe(0)
  })
})
