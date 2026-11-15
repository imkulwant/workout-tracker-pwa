import { expect, test, type Page } from '@playwright/test'

const picker = (page: Page) =>
  page.getByRole('dialog', { name: 'Add exercises' })
const choose = (page: Page, name: string) =>
  picker(page).getByRole('checkbox', { name: new RegExp(`^${name}`) })
/** The exercise cards of the active workout, by name, in order. */
const cards = (page: Page) => page.locator('section[aria-label] h2')

/** Opens the workout screen, starting a workout if there is none yet. */
async function openWorkout(page: Page) {
  await page.goto('workout')
  const add = page.getByRole('button', { name: 'Add exercise' })
  const start = page.getByRole('button', { name: 'Start workout' })
  await expect(add.or(start)).toBeVisible()
  if (await start.isVisible()) await start.click()
  await expect(add).toBeVisible()
}

async function openPicker(page: Page) {
  await openWorkout(page)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(picker(page)).toBeVisible()
}

/** Records that exercises were used in workouts, straight into IndexedDB. */
async function markRecentlyUsed(
  page: Page,
  uses: [exerciseId: string, at: number][],
) {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('gym-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('workoutExercises', 'readwrite')
          rows.forEach(([exerciseId, at], i) => {
            tx.objectStore('workoutExercises').put({
              id: `we-${i}`,
              createdAt: at,
              updatedAt: at,
              deletedAt: null,
              workoutId: 'w-test',
              exerciseId,
              position: i,
              notes: '',
            })
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    uses,
  )
}

test.describe('exercise picker', () => {
  test('finds a custom exercise you just created, and adds it', async ({
    page,
  }) => {
    await page.goto('exercises/new')
    await page.getByLabel('Name', { exact: true }).fill('Landmine Press')
    await page
      .getByRole('group', { name: 'Primary muscles' })
      .getByRole('button', { name: 'Front delts', exact: true })
      .click()
    await page.getByRole('button', { name: 'Save exercise' }).click()
    await expect(
      page.getByRole('heading', { name: 'Exercises', level: 1 }),
    ).toBeVisible()

    await openPicker(page)
    await picker(page)
      .getByRole('searchbox', { name: 'Search exercises' })
      .fill('landmine')
    await expect(picker(page).getByRole('checkbox')).toHaveCount(1)
    await choose(page, 'Landmine Press').click()
    await picker(page).getByRole('button', { name: 'Add 1 exercise' }).click()

    await expect(picker(page)).toBeHidden()
    await expect(cards(page)).toHaveText(['Landmine Press'])
    // Each added exercise starts with one set row.
    await expect(
      page
        .getByRole('region', { name: 'Landmine Press' })
        .getByRole('listitem'),
    ).toHaveCount(1)
  })

  test('lists every active exercise alphabetically, with no recent group yet', async ({
    page,
  }) => {
    await openPicker(page)

    await expect(picker(page).getByRole('checkbox')).toHaveCount(46)
    await expect(picker(page).getByRole('checkbox').first()).toContainText(
      'Back Extension',
    )
    await expect(
      picker(page).getByRole('heading', { name: 'Recent' }),
    ).toHaveCount(0)
  })

  test('selects several, in tap order, and lets you change your mind', async ({
    page,
  }) => {
    await openPicker(page)
    const add = picker(page).getByRole('button', { name: /^Add/ })
    await expect(add).toBeDisabled()

    await choose(page, 'Deadlift').click()
    await choose(page, 'Back Squat').click()
    await choose(page, 'Hammer Curl').click()
    await expect(add).toHaveText('Add 3 exercises')
    await expect(choose(page, 'Deadlift')).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await choose(page, 'Hammer Curl').click()
    await expect(add).toHaveText('Add 2 exercises')
    await expect(choose(page, 'Hammer Curl')).toHaveAttribute(
      'aria-checked',
      'false',
    )

    await add.click()
    await expect(cards(page)).toHaveText(['Deadlift', 'Back Squat'])
  })

  test('filters as you type, and says when nothing matches', async ({
    page,
  }) => {
    await openPicker(page)
    const search = picker(page).getByRole('searchbox', {
      name: 'Search exercises',
    })

    await search.fill('squat')
    await expect(picker(page).getByRole('checkbox')).toHaveCount(3)

    await search.fill('zercher')
    await expect(picker(page).getByText('No exercises match.')).toBeVisible()
    await expect(picker(page).getByRole('checkbox')).toHaveCount(0)
  })

  test('does not offer an archived exercise, and offers it again once restored', async ({
    page,
  }) => {
    await page.goto('exercises/seed-hammer-curl')
    await page.getByRole('button', { name: 'Archive' }).click()
    await page
      .getByRole('dialog', { name: 'Archive Hammer Curl?' })
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()

    await openPicker(page)
    await expect(picker(page).getByRole('checkbox')).toHaveCount(45)
    await expect(choose(page, 'Hammer Curl')).toHaveCount(0)

    // A launch now opens the workout in progress, so go by the app's own links.
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('link', { name: 'Exercises' }).click()
    await page.getByRole('button', { name: 'Archived' }).click()
    await page.getByRole('link', { name: /^Hammer Curl/ }).click()
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()
    await page.getByRole('link', { name: 'Today' }).click()
    await page.getByRole('link', { name: 'Resume workout' }).click()
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(picker(page).getByRole('checkbox')).toHaveCount(46)
  })

  test('puts recently used exercises first, newest first, without repeating them', async ({
    page,
  }) => {
    await openWorkout(page)
    await markRecentlyUsed(page, [
      ['seed-deadlift', 1000],
      ['seed-pull-up', 3000],
      ['seed-deadlift', 2000],
    ])

    await page.getByRole('button', { name: 'Add exercise' }).click()

    const recent = picker(page).getByRole('list', { name: 'Recent' })
    await expect(recent.getByRole('checkbox')).toHaveCount(2)
    await expect(recent.getByRole('checkbox').first()).toContainText('Pull-Up')
    await expect(recent.getByRole('checkbox').last()).toContainText('Deadlift')
    const rest = picker(page).getByRole('list', { name: 'All exercises' })
    await expect(rest.getByRole('checkbox')).toHaveCount(44)
    await expect(rest.getByRole('checkbox', { name: /^Deadlift/ })).toHaveCount(
      0,
    )
  })

  test('opens with focus on its title, so the phone keyboard stays down', async ({
    page,
  }) => {
    await openPicker(page)

    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent,
    }))

    expect(focused).toEqual({ tag: 'H2', text: 'Add exercises' })
  })

  test('starts clean each time it opens', async ({ page }) => {
    await openPicker(page)
    await picker(page)
      .getByRole('searchbox', { name: 'Search exercises' })
      .fill('curl')
    await choose(page, 'Hammer Curl').click()
    await page.keyboard.press('Escape')
    await expect(picker(page)).toBeHidden()

    await page.getByRole('button', { name: 'Add exercise' }).click()

    await expect(
      picker(page).getByRole('searchbox', { name: 'Search exercises' }),
    ).toHaveValue('')
    await expect(
      picker(page).getByRole('button', { name: 'Add exercises' }),
    ).toBeDisabled()
    await expect(picker(page).getByRole('checkbox')).toHaveCount(46)
  })
})
