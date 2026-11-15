import { expect, test, type Page } from '@playwright/test'

const list = (page: Page) => page.getByRole('list', { name: 'Exercise list' })
const rows = (page: Page) => list(page).getByRole('listitem')
const search = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search exercises' })
const chip = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Filter by body part' })
    .getByRole('button', { name, exact: true })
// The result count. The toast area is also a status region, so be specific.
const count = (page: Page) => page.locator('p[role="status"]')

test.describe('exercise library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('exercises')
    await expect(rows(page).first()).toBeVisible()
  })

  test('lists the 46 seeded exercises alphabetically', async ({ page }) => {
    await expect(rows(page)).toHaveCount(46)
    await expect(count(page)).toHaveText('46 exercises')
    await expect(rows(page).first()).toContainText('Back Extension')
  })

  test('shows equipment and primary muscles on each row', async ({ page }) => {
    await expect(
      // Anchored, because "Incline Barbell Bench Press" contains the name too.
      rows(page).filter({ hasText: /^Barbell Bench Press/ }),
    ).toContainText('Barbell · Chest')
    await expect(
      rows(page).filter({ hasText: 'Deadlift' }).first(),
    ).toContainText('Glutes, Hamstrings, Lower back')
  })

  test('narrows the list as you type, ignoring case', async ({ page }) => {
    await search(page).fill('BENCH')

    await expect(rows(page)).toHaveText([
      /Barbell Bench Press/,
      /Dumbbell Bench Press/,
      /Incline Barbell Bench Press/,
    ])
    await expect(count(page)).toHaveText('3 exercises')
  })

  test('matches words in any order', async ({ page }) => {
    await search(page).fill('press bench')

    await expect(rows(page)).toHaveCount(3)
  })

  test('filters by body part and resets with All', async ({ page }) => {
    await chip(page, 'Legs').click()

    await expect(chip(page, 'Legs')).toHaveAttribute('aria-pressed', 'true')
    await expect(rows(page).filter({ hasText: 'Back Squat' })).toHaveCount(1)
    await expect(rows(page).filter({ hasText: 'Barbell Curl' })).toHaveCount(0)

    await chip(page, 'All').click()
    await expect(rows(page)).toHaveCount(46)
  })

  test('combines search and a body part', async ({ page }) => {
    await search(page).fill('press')
    await chip(page, 'Shoulders').click()

    await expect(rows(page)).toHaveText([
      /Machine Shoulder Press/,
      /Overhead Press/,
      /Seated Dumbbell Press/,
    ])
  })

  test('answers a search within 100 ms on the seed data', async ({ page }) => {
    // Measured in the page, from the input event until the filtered rows are
    // in the DOM, so Playwright's round trips are not counted. Paint time is
    // left out on purpose: it follows the display refresh and the machine's
    // load, not the search. On a quiet page the rows are in the DOM within
    // 1 to 7 ms, and painted within two frames, about 33 ms.
    const result = await page.evaluate(async () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[type="search"]',
      )!
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!
      const start = performance.now()
      setValue.call(input, 'squat')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      // React flushes a discrete event before it returns; one microtask is slack.
      await Promise.resolve()
      const elapsed = performance.now() - start
      const rows = document.querySelectorAll(
        'ul[aria-label="Exercise list"] > li',
      ).length
      return { elapsed, rows }
    })

    // The three squats were already listed when the clock stopped.
    expect(result.rows).toBe(3)
    expect(result.elapsed).toBeLessThan(100)
  })

  test('offers to add an exercise when nothing matches', async ({ page }) => {
    await search(page).fill('zercher squat')

    await expect(page.getByText('No exercises match')).toBeVisible()
    await expect(
      page.getByText('Nothing is called "zercher squat".'),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Add it as a new exercise' }),
    ).toHaveAttribute('href', /exercises\/new\?name=zercher%20squat$/)
  })

  test('opens an exercise from its row', async ({ page }) => {
    await rows(page)
      .filter({ hasText: 'Hammer Curl' })
      .getByRole('link')
      .click()

    await expect(page).toHaveURL(/exercises\/seed-hammer-curl$/)
  })
})
