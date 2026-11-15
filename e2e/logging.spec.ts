import { expect, test, type Page } from '@playwright/test'
import {
  BENCH,
  card,
  enter,
  options,
  reps,
  setRows,
  startWith,
  tick,
  weight,
} from './helpers.ts'

test.describe('starting and resuming', () => {
  test('starts from Today, and Today then offers to resume', async ({
    page,
  }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'Start workout' }).click()
    await expect(page).toHaveURL(/\/workout$/)
    await expect(page.getByText('Add your first exercise')).toBeVisible()

    await page.goto('./')

    await expect(
      page.getByRole('button', { name: 'Start workout' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Resume workout' }),
    ).toBeVisible()
  })

  test('offers to start one when /workout is opened with none in progress', async ({
    page,
  }) => {
    await page.goto('workout')

    await expect(page.getByText('No workout in progress')).toBeVisible()
    await page.getByRole('button', { name: 'Start workout' }).click()
    await expect(page.getByText('Add your first exercise')).toBeVisible()
  })
})

test.describe('logging sets', () => {
  test('logs three sets and finds them all after a reload', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await enter(weight(c, 1), '80')
    await enter(reps(c, 1), '5')
    await tick(c, 1).click()
    await c.getByRole('button', { name: 'Add set' }).click()
    await tick(c, 2).click() // prefilled from the row above: one tap
    await c.getByRole('button', { name: 'Add set' }).click()
    await enter(weight(c, 3), '82.5')
    await enter(reps(c, 3), '4')
    await tick(c, 3).click()

    await page.reload()

    const after = card(page, BENCH)
    await expect(setRows(after)).toHaveCount(3)
    await expect(weight(after, 1)).toHaveValue('80')
    await expect(reps(after, 1)).toHaveValue('5')
    await expect(weight(after, 2)).toHaveValue('80')
    await expect(reps(after, 2)).toHaveValue('5')
    await expect(weight(after, 3)).toHaveValue('82.5')
    await expect(reps(after, 3)).toHaveValue('4')
    for (const n of [1, 2, 3]) {
      await expect(tick(after, n)).toHaveAttribute('aria-checked', 'true')
    }
  })

  test('a prefilled set completes with one tap on its tick', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await enter(weight(c, 1), '60')
    await enter(reps(c, 1), '8')
    await tick(c, 1).click()
    await c.getByRole('button', { name: 'Add set' }).click()
    await expect(weight(c, 2)).toHaveValue('60')
    await expect(reps(c, 2)).toHaveValue('8')

    await tick(c, 2).click()

    await expect(tick(c, 2)).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('stores a value when you leave the field, without ticking', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await enter(weight(c, 1), '70')
    await page.reload()

    await expect(weight(card(page, BENCH), 1)).toHaveValue('70')
    await expect(tick(card(page, BENCH), 1)).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  test('keeps reps typed right after leaving the weight field', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    // Moving to reps saves the weight. That save must not wipe the reps being
    // typed in the meantime.
    await weight(c, 1).fill('80')
    await reps(c, 1).fill('5')
    await expect(reps(c, 1)).toHaveValue('5')
    await reps(c, 1).blur()

    await page.reload()
    await expect(weight(card(page, BENCH), 1)).toHaveValue('80')
    await expect(reps(card(page, BENCH), 1)).toHaveValue('5')
  })

  test('stores 82,5 and 82.5 as the same value', async ({ page }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await enter(weight(c, 1), '82,5')
    await enter(reps(c, 1), '5')
    await tick(c, 1).click()
    await c.getByRole('button', { name: 'Add set' }).click()
    await enter(weight(c, 2), '82.5')
    await tick(c, 2).click()

    await page.reload()

    const after = card(page, BENCH)
    await expect(weight(after, 1)).toHaveValue('82.5')
    await expect(weight(after, 2)).toHaveValue('82.5')
  })

  test('unticking a set makes it incomplete again', async ({ page }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await enter(weight(c, 1), '80')
    await enter(reps(c, 1), '5')
    await tick(c, 1).click()
    await expect(tick(c, 1)).toHaveAttribute('aria-checked', 'true')

    await tick(c, 1).click()

    await expect(tick(c, 1)).toHaveAttribute('aria-checked', 'false')
    await page.reload()
    await expect(tick(card(page, BENCH), 1)).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await expect(weight(card(page, BENCH), 1)).toHaveValue('80')
  })

  test('shows when there is no previous session to compare with', async ({
    page,
  }) => {
    await startWith(page, BENCH)

    await expect(card(page, BENCH).getByText('–').first()).toBeVisible()
  })
})

test.describe('completing a set needs its values', () => {
  test('refuses an empty set, and says what is missing', async ({ page }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await tick(c, 1).click()

    await expect(tick(c, 1)).toHaveAttribute('aria-checked', 'false')
    await expect(c.getByRole('alert')).toContainText(
      'Enter a weight to complete this set.',
    )
    await expect(c.getByRole('alert')).toContainText(
      'Enter reps to complete this set.',
    )
  })

  test('asks only for reps when the weight is already there', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await enter(weight(c, 1), '80')

    await tick(c, 1).click()

    await expect(c.getByRole('alert')).toHaveText(
      'Enter reps to complete this set.',
    )
    await expect(tick(c, 1)).toHaveAttribute('aria-checked', 'false')
  })

  test('clears the message once the field is filled and the set completes', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await tick(c, 1).click()
    await expect(c.getByRole('alert')).toBeVisible()

    await weight(c, 1).fill('80')
    await reps(c, 1).fill('5')
    await tick(c, 1).click()

    await expect(c.getByRole('alert')).toHaveCount(0)
    await expect(tick(c, 1)).toHaveAttribute('aria-checked', 'true')
  })

  test('lets a bodyweight exercise complete with reps only', async ({
    page,
  }) => {
    await startWith(page, 'Push-Up')
    const c = card(page, 'Push-Up')

    await enter(reps(c, 1), '15')
    await tick(c, 1).click()

    await expect(tick(c, 1)).toHaveAttribute('aria-checked', 'true')
    await expect(c.getByRole('alert')).toHaveCount(0)
  })

  test('rejects a weight above 1000 kg and does not store it', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await enter(weight(c, 1), '1500')

    await expect(c.getByRole('alert')).toHaveText(
      'Weight must be from 0 to 1000 kg.',
    )
    await expect(weight(c, 1)).toHaveAttribute('aria-invalid', 'true')
    await page.reload()
    await expect(weight(card(page, BENCH), 1)).toHaveValue('')
  })

  test('rejects reps that are not a whole number from 1 to 999', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await enter(reps(c, 1), '5.5')
    await expect(c.getByRole('alert')).toHaveText(
      'Reps must be a whole number from 1 to 999.',
    )
    await enter(reps(c, 1), '0')
    await expect(c.getByRole('alert')).toHaveText(
      'Reps must be a whole number from 1 to 999.',
    )
  })

  test('only accepts digits, a point and a comma while typing', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await weight(c, 1).pressSequentially('8a2,b5-kg')

    await expect(weight(c, 1)).toHaveValue('82,5')
  })

  test('uses the right keyboards: decimal for weight, numeric for reps', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)

    await expect(weight(c, 1)).toHaveAttribute('inputmode', 'decimal')
    await expect(reps(c, 1)).toHaveAttribute('inputmode', 'numeric')
    const sizes = await Promise.all(
      [weight(c, 1), reps(c, 1)].map((f) =>
        f.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ),
    )
    expect(sizes.every((s) => s >= 16)).toBe(true)
  })
})

test.describe('set types', () => {
  test('changes a set to a warm-up without shifting the numbering', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await c.getByRole('button', { name: 'Add set' }).click()
    await c.getByRole('button', { name: 'Add set' }).click()
    await expect(options(c, 1)).toHaveText('1')

    await options(c, 1).click()
    const menu = page.getByRole('dialog', { name: 'Set 1' })
    await menu.getByRole('button', { name: 'Warm-up' }).click()

    await expect(menu).toBeHidden()
    await expect(options(c, 1)).toHaveText('W')
    await expect(options(c, 2)).toHaveText('1')
    await expect(options(c, 3)).toHaveText('2')
    await page.reload()
    await expect(options(card(page, BENCH), 1)).toHaveText('W')
  })

  test('offers every set type, marks the current one, and shows D and F', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await options(c, 1).click()
    const menu = page.getByRole('dialog', { name: 'Set 1' })
    const group = menu.getByRole('group', { name: 'Set type' })

    await expect(group.getByRole('button')).toHaveText([
      'Working set',
      'Warm-up',
      'Drop set',
      'Failure',
    ])
    await expect(
      group.getByRole('button', { name: 'Working set' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await group.getByRole('button', { name: 'Drop set' }).click()
    await expect(options(c, 1)).toHaveText('D')
    await options(c, 1).click()
    await page
      .getByRole('dialog', { name: 'Set 1' })
      .getByRole('button', { name: 'Failure' })
      .click()
    await expect(options(c, 1)).toHaveText('F')
  })
})

test.describe('deleting a set', () => {
  async function threeNumberedSets(page: Page) {
    await startWith(page, BENCH)
    const c = card(page, BENCH)
    await enter(weight(c, 1), '50')
    await enter(reps(c, 1), '1')
    for (const n of [2, 3]) {
      await c.getByRole('button', { name: 'Add set' }).click()
      await enter(reps(c, n), String(n))
    }
    return c
  }

  test('deletes from the menu and brings it back with Undo', async ({
    page,
  }) => {
    const c = await threeNumberedSets(page)
    await options(c, 2).click()
    await page
      .getByRole('dialog', { name: 'Set 2' })
      .getByRole('button', { name: 'Delete set' })
      .click()

    await expect(setRows(c)).toHaveCount(2)
    await expect(page.getByText('Set deleted')).toBeVisible()
    await expect(reps(c, 2)).toHaveValue('3')

    await page.getByRole('button', { name: 'Undo' }).click()

    await expect(setRows(c)).toHaveCount(3)
    await expect(reps(c, 1)).toHaveValue('1')
    await expect(reps(c, 2)).toHaveValue('2')
    await expect(reps(c, 3)).toHaveValue('3')
  })

  test('the Undo toast goes away after about five seconds, and the set stays deleted', async ({
    page,
  }) => {
    const c = await threeNumberedSets(page)
    await options(c, 3).click()
    await page
      .getByRole('dialog', { name: 'Set 3' })
      .getByRole('button', { name: 'Delete set' })
      .click()
    const undo = page.getByRole('button', { name: 'Undo' })
    await expect(undo).toBeVisible()

    await expect(undo).toBeHidden({ timeout: 8000 })

    await expect(setRows(c)).toHaveCount(2)
  })

  test('a deleted set stays deleted after a reload', async ({ page }) => {
    const c = await threeNumberedSets(page)
    await options(c, 1).click()
    await page
      .getByRole('dialog', { name: 'Set 1' })
      .getByRole('button', { name: 'Delete set' })
      .click()

    await page.reload()

    const after = card(page, BENCH)
    await expect(setRows(after)).toHaveCount(2)
    await expect(reps(after, 1)).toHaveValue('2')
  })
})

test.describe('the workout header', () => {
  test('keeps a title you type', async ({ page }) => {
    await startWith(page, BENCH)
    await enter(page.getByLabel('Workout title'), 'Push day')

    await page.reload()

    await expect(page.getByLabel('Workout title')).toHaveValue('Push day')
  })

  test('shows an elapsed clock that keeps running', async ({ page }) => {
    await startWith(page, BENCH)
    const clock = page.getByRole('timer', { name: 'Elapsed time' })

    await expect(clock).toHaveText(/^\d+:\d{2}$/)
    const first = await clock.textContent()
    await expect
      .poll(async () => clock.textContent(), { timeout: 4000 })
      .not.toBe(first)
  })

  test('adds a second exercise below the first, each with its own sets', async ({
    page,
  }) => {
    await startWith(page, BENCH)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    const picker = page.getByRole('dialog', { name: 'Add exercises' })
    await picker.getByRole('checkbox', { name: /^Back Squat/ }).click()
    await picker.getByRole('button', { name: 'Add 1 exercise' }).click()

    await expect(page.locator('section[aria-label] h2')).toHaveText([
      BENCH,
      'Back Squat',
    ])
    await enter(weight(card(page, 'Back Squat'), 1), '100')
    await expect(weight(card(page, BENCH), 1)).toHaveValue('')
  })
})
