import { expect, test, type Locator, type Page } from '@playwright/test'
import { generateTraining } from '../src/dev/generateTraining.ts'
import { fixToday, seedGenerated } from './helpers.ts'

// Two years of the same generated training, with the clock fixed at Wed 11 Nov
// 2026, so every picture and every number below is the same on every run.
const TRAINING = generateTraining({ endDate: '2026-11-11', seed: 7 })

async function openStats(page: Page) {
  await fixToday(page)
  await page.goto('./')
  await seedGenerated(page, TRAINING)
  await page.goto('stats')
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
  await expect(page.locator('button[data-date]').first()).toBeVisible()
}

const section = (page: Page, name: string): Locator =>
  page.getByRole('region', { name })

const figures = (page: Page): Locator => page.getByTestId('body-figures')

const shot = { animations: 'disabled', maxDiffPixelRatio: 0.01 } as const

test.describe('stats screenshots at iPhone width', () => {
  test('calendar heatmap', async ({ page }) => {
    await openStats(page)
    await expect(section(page, 'Training calendar')).toHaveScreenshot(
      'calendar-sets.png',
      shot,
    )
  })

  test('calendar heatmap, volume of one body part', async ({ page }) => {
    await openStats(page)
    const calendar = section(page, 'Training calendar')
    await calendar.getByRole('button', { name: 'Volume', exact: true }).click()
    await calendar.getByRole('button', { name: 'Legs', exact: true }).click()
    await expect(calendar).toHaveScreenshot('calendar-volume-legs.png', shot)
  })

  test('body map, 30 days', async ({ page }) => {
    await openStats(page)
    await expect(section(page, 'Body map')).toHaveScreenshot(
      'body-map-30.png',
      shot,
    )
  })

  test('body map, 7 days', async ({ page }) => {
    await openStats(page)
    const map = section(page, 'Body map')
    await map.getByRole('button', { name: '7 days' }).click()
    await expect(figures(page)).toHaveScreenshot('body-map-7.png', shot)
  })

  test('muscles by week, with legs open', async ({ page }) => {
    await openStats(page)
    const matrix = section(page, 'Muscles by week')
    await matrix.getByRole('button', { name: 'Legs' }).click()
    await expect(matrix).toHaveScreenshot('matrix-legs-open.png', shot)
  })

  test('weekly volume', async ({ page }) => {
    await openStats(page)
    await expect(section(page, 'Weekly volume')).toHaveScreenshot(
      'volume-bars.png',
      shot,
    )
  })

  test('exercise progress', async ({ page }) => {
    await fixToday(page)
    await page.goto('./')
    await seedGenerated(page, TRAINING)
    await page.goto('exercises/seed-barbell-bench-press')
    await expect(section(page, 'Progress')).toBeVisible()
    await expect(section(page, 'Progress')).toHaveScreenshot(
      'progress-e1rm.png',
      shot,
    )
  })
})

test.describe('stats with two years of training', () => {
  test('renders in under 500 ms after tapping the tab', async ({ page }) => {
    await fixToday(page)
    await page.goto('./')
    await seedGenerated(page, TRAINING)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    // From the tap until the calendar cells and the body map are both in the page.
    const ms = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const link = [...document.querySelectorAll('a')].find(
            (a) => a.textContent?.trim() === 'Stats',
          )!
          const start = performance.now()
          const ready = () =>
            document.querySelectorAll('button[data-date]').length > 300 &&
            document.querySelector('svg path[data-muscle]') !== null &&
            document.querySelectorAll('svg g[data-week]').length === 12
          const observer = new MutationObserver(() => {
            if (ready()) {
              observer.disconnect()
              resolve(performance.now() - start)
            }
          })
          observer.observe(document.body, { childList: true, subtree: true })
          link.click()
        }),
    )
    console.log(`Stats rendered in ${Math.round(ms)} ms`)
    expect(ms).toBeLessThan(500)
  })

  test('has hundreds of workouts and thousands of sets behind the numbers', async () => {
    expect(TRAINING.workouts.length).toBeGreaterThan(250)
    expect(TRAINING.sets.length).toBeGreaterThan(4000)
  })
})
