import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { generateTraining } from '../src/dev/generateTraining.ts'
import {
  BENCH,
  card,
  fixToday,
  logSet,
  seedFinishedWorkouts,
  seedGenerated,
  startWith,
} from './helpers.ts'

const TRAINING = generateTraining({ endDate: '2026-11-11', seed: 7 })

/** Violations axe finds on the page as it is now, as short readable lines. */
async function violations(page: Page) {
  // Contrast is measured on what is drawn, so let screens finish fading in.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  )
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
}

const SCREENS = [
  ['Today', './'],
  ['History', 'history'],
  ['History detail', 'history/seeded-w-0'],
  ['Stats', 'stats'],
  ['Exercises', 'exercises'],
  ['Exercise detail', 'exercises/seed-barbell-bench-press'],
  ['New exercise', 'exercises/new'],
  ['Templates', 'templates'],
  ['New template', 'templates/new'],
  ['Settings', 'settings'],
] as const

test.describe('accessibility', () => {
  for (const [name, path] of SCREENS) {
    test(`${name} has no automatically detectable violations`, async ({
      page,
    }) => {
      await fixToday(page)
      await page.goto('./')
      await seedFinishedWorkouts(page, 3)
      await seedGenerated(page, TRAINING)
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(
        page.getByRole('status').filter({ hasText: 'Loading' }),
      ).toHaveCount(0)
      expect(await violations(page)).toEqual([])
    })
  }

  test('the workout screen, with sets and the rest bar', async ({ page }) => {
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible()
    expect(await violations(page)).toEqual([])
  })

  test('a sheet and a dialog', async ({ page }) => {
    await startWith(page, BENCH)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Add exercises' }),
    ).toBeVisible()
    expect(await violations(page)).toEqual([])
  })
})

test.describe('large text', () => {
  // iOS "Larger Text" scales the root font size. Everything here is in rem, so
  // 150% on the narrowest current iPhone (375 points) shows whether anything
  // would spill sideways.
  test.use({ viewport: { width: 375, height: 667 } })

  const PAGES = [
    ['Today', './'],
    ['History', 'history'],
    ['Stats', 'stats'],
    ['Exercises', 'exercises'],
    ['Templates', 'templates'],
    ['Settings', 'settings'],
    ['A workout', 'history/seeded-w-0'],
  ] as const

  for (const [name, path] of PAGES) {
    test(`${name} does not scroll sideways at 150% text`, async ({ page }) => {
      await fixToday(page)
      await page.goto('./')
      await seedFinishedWorkouts(page, 3)
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(
        page.getByRole('status').filter({ hasText: 'Loading' }),
      ).toHaveCount(0)
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished)),
      )
      // Set through the DOM, because the app's CSP rightly refuses an injected style tag.
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '150%'
      })

      const overflow = await page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body
        return main.scrollWidth - main.clientWidth
      })
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test.describe('focus', () => {
  test('a sheet takes focus when it opens and gives it back when it closes', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const opener = page.getByRole('button', { name: 'Add exercise' })
    await opener.click()
    const sheet = page.getByRole('dialog', { name: 'Add exercises' })
    await expect(sheet).toBeVisible()
    // Focus is on the title, so the phone keyboard stays down.
    await expect(
      sheet.getByRole('heading', { name: 'Add exercises' }),
    ).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(opener).toBeFocused()
  })
})
