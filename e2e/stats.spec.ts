import { expect, test, type Page } from '@playwright/test'
import {
  BENCH,
  card,
  enter,
  fixToday,
  logSet,
  seedFinishedWorkouts,
  startWith,
  weight,
} from './helpers.ts'

/** Four workouts: Tue 10, Mon 9, Sun 8 and Sat 7 Nov 2026, with "today" as Wed 11 Nov. */
async function openStats(page: Page, workouts = 4) {
  await fixToday(page)
  await page.goto('./')
  await seedFinishedWorkouts(page, workouts)
  await page.goto('stats')
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
  // The heading shows while the data loads, so wait for the screen itself.
  await expect(page.locator('button[data-date]').first()).toBeVisible()
  await expect(page.locator('svg path[data-muscle]').first()).toBeAttached()
}

const cell = (page: Page, label: RegExp | string) =>
  page.getByRole('button', { name: label })

test.describe('summary tiles', () => {
  test('show this week and the weekly streak', async ({ page }) => {
    await openStats(page)
    const week = page.getByRole('region', { name: 'This week' })
    // Mon 9 and Tue 10 are this week. Sat 7 and Sun 8 are last week.
    await expect(
      week.getByText('Workouts', { exact: true }).locator('..'),
    ).toContainText('2')
    await expect(
      week.getByText('Sets', { exact: true }).locator('..'),
    ).toContainText('2')
    await expect(
      week.getByText('Volume', { exact: true }).locator('..'),
    ).toContainText('1,000 kg')
    await expect(
      week.getByText('Streak', { exact: true }).locator('..'),
    ).toContainText('2 weeks')
  })

  test('start at zero on a fresh install', async ({ page }) => {
    await fixToday(page)
    await page.goto('stats')
    const week = page.getByRole('region', { name: 'This week' })
    await expect(
      week.getByText('Streak', { exact: true }).locator('..'),
    ).toContainText('0 weeks')
    await expect(
      week.getByText('Volume', { exact: true }).locator('..'),
    ).toContainText('0 kg')
  })
})

test.describe('calendar heatmap', () => {
  test('has a cell per day up to today, in 53 Monday-start weeks', async ({
    page,
  }) => {
    await openStats(page)
    // 53 weeks of 7 days, minus Thu 12 to Sun 15 Nov, which have not happened.
    await expect(page.locator('button[data-date]')).toHaveCount(53 * 7 - 4)
    await expect(cell(page, /^Wed 11 Nov:/)).toBeVisible()
    await expect(cell(page, /^Thu 12 Nov:/)).toHaveCount(0)
  })

  test('opens on the current week', async ({ page }) => {
    await openStats(page)
    await expect(cell(page, /^Wed 11 Nov:/)).toBeInViewport()
    await expect(cell(page, /^Sun 15 Nov:/)).toHaveCount(0)
  })

  test('shades days with training, and says what each holds', async ({
    page,
  }) => {
    await openStats(page)
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toBeVisible()
    // Four days of one set each tie, so they all rank at the lowest level.
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toHaveAttribute(
      'data-level',
      '1',
    )
    await expect(cell(page, 'Wed 11 Nov: no training')).toHaveAttribute(
      'data-level',
      '0',
    )
  })

  test('makes every day level 2 when there are fewer than four', async ({
    page,
  }) => {
    await openStats(page, 3)
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toHaveAttribute(
      'data-level',
      '2',
    )
    await expect(cell(page, 'Mon 9 Nov: 1 set')).toHaveAttribute(
      'data-level',
      '2',
    )
  })

  test('switches between sets, volume and duration', async ({ page }) => {
    await openStats(page)
    await page.getByRole('button', { name: 'Volume', exact: true }).click()
    await expect(cell(page, 'Tue 10 Nov: 500 kg')).toBeVisible()
    await page.getByRole('button', { name: 'Duration', exact: true }).click()
    await expect(cell(page, 'Tue 10 Nov: 1 h 00 min')).toBeVisible()
  })

  test('filters by body part', async ({ page }) => {
    await openStats(page)
    const group = page.getByRole('group', { name: 'Body part' })
    await group.getByRole('button', { name: 'Chest' }).click()
    await expect(cell(page, 'Tue 10 Nov: 1 set')).toBeVisible()
    await group.getByRole('button', { name: 'Legs' }).click()
    await expect(cell(page, 'Tue 10 Nov: no training')).toBeVisible()
  })

  test('opens the day in a sheet, with a link to the workout', async ({
    page,
  }) => {
    await openStats(page)
    await cell(page, /^Tue 10 Nov/).click()
    const sheet = page.getByRole('dialog', { name: '10 Nov 2026' })
    await expect(sheet.getByRole('link', { name: /Seeded 0/ })).toBeVisible()
    await sheet.getByRole('link', { name: /Seeded 0/ }).click()
    await expect(page).toHaveURL(/\/history\/seeded-w-0$/)
  })

  test('says so for a day with no workout', async ({ page }) => {
    await openStats(page)
    await cell(page, /^Wed 11 Nov/).click()
    await expect(
      page
        .getByRole('dialog', { name: '11 Nov 2026' })
        .getByText('No workouts on this day.'),
    ).toBeVisible()
  })

  test('has a visible colour key', async ({ page }) => {
    await openStats(page)
    const key = page.getByRole('list', { name: /^Colour key/ }).first()
    await expect(key).toBeVisible()
    await expect(key.getByRole('listitem')).toHaveText([
      'none',
      'low',
      'some',
      'high',
      'highest',
    ])
  })
})

test.describe('body map', () => {
  const region = (page: Page, muscle: string) =>
    page.locator(`svg path[data-muscle="${muscle}"]`).first()

  test('draws all 18 muscles, front and back', async ({ page }) => {
    await openStats(page)
    const muscles = await page
      .locator('svg path[data-muscle]')
      .evaluateAll((paths) =>
        [...new Set(paths.map((p) => p.getAttribute('data-muscle')))].sort(),
      )
    expect(muscles).toEqual(
      [
        'abs',
        'adductors',
        'biceps',
        'calves',
        'chest',
        'forearms',
        'front_delts',
        'glutes',
        'hamstrings',
        'lats',
        'lower_back',
        'obliques',
        'quads',
        'rear_delts',
        'side_delts',
        'traps',
        'triceps',
        'upper_back',
      ].sort(),
    )
  })

  test('shades by sets a week over the chosen range', async ({ page }) => {
    await openStats(page)
    const range = page.getByRole('group', { name: 'Range' })

    // Four bench sets in the last 7 days: chest 4.0 a week, triceps 2.0.
    await range.getByRole('button', { name: '7 days' }).click()
    await expect(region(page, 'chest')).toHaveAttribute('data-level', '2')
    await expect(region(page, 'triceps')).toHaveAttribute('data-level', '1')
    await expect(region(page, 'quads')).toHaveAttribute('data-level', '0')
    await expect(
      page.getByRole('button', { name: 'Chest, 4.0 sets a week' }),
    ).toBeVisible()

    // The same sets over 30 days are 0.9 a week.
    await range.getByRole('button', { name: '30 days' }).click()
    await expect(region(page, 'chest')).toHaveAttribute('data-level', '1')
    await expect(
      page.getByRole('button', { name: 'Chest, 0.9 sets a week' }),
    ).toBeVisible()
  })

  test('opens a muscle with its rate, last date and top exercises', async ({
    page,
  }) => {
    await openStats(page)
    await page
      .getByRole('group', { name: 'Range' })
      .getByRole('button', { name: '7 days' })
      .click()
    await page.getByRole('button', { name: /^Chest, / }).click()

    const sheet = page.getByRole('dialog', { name: 'Chest' })
    await expect(sheet).toContainText('4.0 sets a week')
    await expect(sheet).toContainText('10 Nov 2026')
    await expect(sheet).toContainText('Barbell Bench Press')
    await expect(sheet).toContainText('4 sets')
  })

  test('says so when a muscle was not trained in the range', async ({
    page,
  }) => {
    await openStats(page)
    await page.getByRole('button', { name: /^Quads, / }).click()
    const sheet = page.getByRole('dialog', { name: 'Quads' })
    await expect(sheet).toContainText('Not yet')
    await expect(sheet).toContainText('None in this range')
  })

  test('lists every muscle as text, most worked first, and opens them', async ({
    page,
  }) => {
    await openStats(page)
    const list = page.getByRole('list', { name: 'Muscles, most worked first' })
    await expect(list.getByRole('listitem')).toHaveCount(18)
    await expect(list.getByRole('listitem').first()).toContainText('Chest')
    await expect(list.getByRole('listitem').last()).not.toContainText('Chest')

    await list.getByRole('button', { name: /^Chest/ }).click()
    await expect(page.getByRole('dialog', { name: 'Chest' })).toBeVisible()
  })

  test('has a visible colour key', async ({ page }) => {
    await openStats(page)
    await expect(
      page
        .getByRole('region', { name: 'Body map' })
        .getByRole('list', { name: /^Colour key, sets a week/ }),
    ).toBeVisible()
  })
})

test.describe('muscles by week', () => {
  test('has a visible colour key', async ({ page }) => {
    await openStats(page)
    await expect(
      page
        .getByRole('region', { name: 'Muscles by week' })
        .getByRole('list', { name: /^Colour key, sets a week/ }),
    ).toBeVisible()
  })

  test('shows sets a week for each body part over 12 weeks', async ({
    page,
  }) => {
    await openStats(page)
    const table = page.getByRole('table', {
      name: /^Sets per week for each body part/,
    })
    await expect(table.getByRole('columnheader')).toHaveCount(13)
    await expect(table.getByRole('columnheader').nth(12)).toHaveText('9 Nov')
    await expect(table.getByRole('columnheader').nth(1)).toHaveText('24 Aug')

    // Two bench sets in each of the last two weeks.
    await expect(
      table.getByLabel('Chest, week of 9 Nov: 2 sets, low'),
    ).toHaveAttribute('data-level', '1')
    await expect(
      table.getByLabel('Chest, week of 2 Nov: 2 sets, low'),
    ).toBeVisible()
    await expect(
      table.getByLabel('Chest, week of 26 Oct: 0 sets, none'),
    ).toHaveAttribute('data-level', '0')
    await expect(
      table.getByLabel('Arms, week of 9 Nov: 1 set, low'),
    ).toBeVisible()
  })

  test('expands a body part into its muscles', async ({ page }) => {
    await openStats(page)
    const table = page.getByRole('table', {
      name: /^Sets per week for each body part/,
    })
    await expect(table.getByRole('rowheader', { name: 'Triceps' })).toHaveCount(
      0,
    )

    await table.getByRole('button', { name: 'Arms' }).click()
    await expect(table.getByRole('button', { name: 'Arms' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(
      table.getByRole('rowheader', { name: 'Triceps' }),
    ).toBeVisible()
    await expect(table.getByRole('rowheader', { name: 'Biceps' })).toBeVisible()
    await expect(
      table.getByLabel('Triceps, week of 9 Nov: 1 set, low'),
    ).toBeVisible()

    await table.getByRole('button', { name: 'Arms' }).click()
    await expect(table.getByRole('rowheader', { name: 'Triceps' })).toHaveCount(
      0,
    )
  })
})

test.describe('weekly volume', () => {
  test('draws 12 weeks, with the numbers as a table', async ({ page }) => {
    await openStats(page)
    await expect(
      page.getByRole('img', { name: /^Weekly volume for the last 12 weeks/ }),
    ).toBeVisible()
    await expect(page.locator('svg g[data-week]')).toHaveCount(12)

    const table = page.getByRole('table', {
      name: 'Volume per week, in kilograms',
    })
    await expect(table.getByRole('row', { name: /^9 Nov/ })).toContainText(
      '1,000 kg',
    )
    await expect(table.getByRole('row', { name: /^2 Nov/ })).toContainText(
      '1,000 kg',
    )
    await expect(table.getByRole('row', { name: /^26 Oct/ })).toContainText(
      '0 kg',
    )
  })
})

test.describe('records', () => {
  const finish = async (page: Page) => {
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
  }

  test('shows what a finished workout beat, and what it beat it by', async ({
    page,
  }) => {
    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 3) // 100 kg x 5 on three days
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '105', '5')
    await finish(page)

    const records = page.getByRole('region', { name: 'Records' })
    await expect(records).toContainText('Barbell Bench Press')
    await expect(records).toContainText('Heaviest weight')
    await expect(records).toContainText('105 kg')
    await expect(records).toContainText('(was 100 kg)')
    await expect(records).toContainText('Best estimated 1RM')
    await expect(records).toContainText('122.5 kg')
    await expect(records).toContainText('(was 116.5 kg)')
    await expect(records).toContainText('Best set volume')
    await expect(records).toContainText('525 kg')
    await expect(records).not.toContainText('Most reps')
  })

  test('treats the first time as a baseline, with no records', async ({
    page,
  }) => {
    await fixToday(page)
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '60', '8')
    await finish(page)

    await expect(
      page.getByRole('heading', { name: 'Workout done' }),
    ).toBeVisible()
    await expect(page.getByRole('region', { name: 'Records' })).toHaveCount(0)
  })

  test('does not celebrate a tie', async ({ page }) => {
    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 3)
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '100', '5')
    await finish(page)

    await expect(
      page.getByRole('heading', { name: 'Workout done' }),
    ).toBeVisible()
    await expect(page.getByRole('region', { name: 'Records' })).toHaveCount(0)
  })

  test('shows them on the workout detail and recomputes after an earlier workout is edited', async ({
    page,
  }) => {
    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 3)
    await startWith(page, BENCH)
    await logSet(card(page, BENCH), 1, '105', '5')
    await finish(page)
    await page.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('link', { name: 'History' }).click()
    await page
      .getByRole('link', { name: /Workout/ })
      .first()
      .click()
    await expect(page.getByRole('region', { name: 'Records' })).toContainText(
      '(was 100 kg)',
    )

    // An earlier workout is corrected to 110 kg, so 105 kg is no longer a record.
    await page.goto('history/seeded-w-0')
    await enter(weight(card(page, BENCH), 1), '110')
    await expect(page.getByText('550 kg').first()).toBeVisible()

    await page.getByRole('link', { name: 'History' }).click()
    await page
      .getByRole('link', { name: /Workout/ })
      .first()
      .click()
    await expect(page.getByRole('region', { name: 'Records' })).toHaveCount(0)
  })
})

test.describe('exercise stats', () => {
  test('shows personal records and a progress chart', async ({ page }) => {
    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 4)
    await page.goto('exercises/seed-barbell-bench-press')

    const bests = page.getByRole('region', { name: 'Personal records' })
    // Equal bests keep the first date they were reached: Sat 7 Nov.
    await expect(bests).toContainText('Heaviest weight')
    await expect(bests).toContainText('100 kg')
    await expect(bests).toContainText('7 Nov 2026')
    await expect(bests).toContainText('116.5 kg')
    await expect(bests).toContainText('500 kg')
    await expect(bests).not.toContainText('Most reps')

    await expect(
      page.getByRole('img', { name: /^Progress over 4 sessions/ }),
    ).toBeVisible()
    const table = page.getByRole('table', { name: 'Progress by session' })
    await expect(table.getByRole('row')).toHaveCount(5)
  })

  test('switches the measure and the range', async ({ page }) => {
    await fixToday(page)
    await page.goto('./')
    await seedFinishedWorkouts(page, 4)
    await page.goto('exercises/seed-barbell-bench-press')

    await page
      .getByRole('group', { name: 'Measure' })
      .getByRole('button', { name: 'Volume' })
      .click()
    await expect(
      page
        .getByRole('table', { name: 'Progress by session' })
        .getByRole('row')
        .nth(1),
    ).toContainText('500')

    await page
      .getByRole('group', { name: 'Time range' })
      .getByRole('button', { name: '3 months' })
      .click()
    await expect(
      page.getByRole('img', { name: /^Progress over 4 sessions/ }),
    ).toBeVisible()
  })

  test('says so when there is nothing to show', async ({ page }) => {
    await fixToday(page)
    await page.goto('exercises/seed-barbell-bench-press')
    await expect(page.getByText('No completed sets yet.')).toBeVisible()
    await expect(
      page.getByText('Nothing to show for this measure and range.'),
    ).toBeVisible()
  })
})
