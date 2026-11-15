# Workout Tracker

An offline-first workout logger for one person on one iPhone. It is a
progressive web app: React, TypeScript, Vite, Dexie (IndexedDB) and Tailwind,
hosted as static files. There is no server and no account. Everything is stored
on the device.

Live site: <https://imkulwant.github.io/workout-tracker-pwa/>

## What it does

- Log workouts set by set, with prefilled weights and reps, set types, a rest
  timer that survives backgrounding, and a screen that stays on.
- Resume a workout after a force-quit, and finish, discard or tidy one that was
  left open.
- Browse and edit history by week, with records.
- Start workouts from templates, or save a finished workout as a template.
- Stats: a calendar heatmap, a body map, a muscle-by-week matrix, weekly volume
  and progress charts.
- Back up everything to a JSON file in Files, export sets as CSV, and restore.

The full specification is `docs/PLAN.md`. Choices made while building it are in
`docs/DECISIONS.md`, and `docs/PROGRESS.md` is the running handover.

## Install on an iPhone

The app works in a Safari tab as it is. To use it like an app:

1. Open the live site in Safari.
2. Tap Share, then Add to Home Screen, and keep Open as Web App on.
3. Open it from the new icon.

A Safari tab and the Home Screen app have **separate storage** on iOS. Pick one
and keep to it. To move data between them, save a backup in one and restore it
in the other.

## Develop

You need Node 26 and npm.

```sh
npm ci
npm run dev          # http://localhost:5173/
```

| Command                             | What it does                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run verify`                    | Lint, type check, unit tests, production build and the bundle size check. This is what CI runs. |
| `npm test`                          | Unit tests (Vitest, with `fake-indexeddb`, in the Europe/Stockholm time zone).                  |
| `npm run test:e2e`                  | End-to-end tests in iPhone WebKit (Playwright). It builds the app and serves it first.          |
| `npm run lint`, `npm run typecheck` | ESLint and `tsc -b`.                                                                            |
| `npm run format`                    | Prettier.                                                                                       |
| `npm run icons`                     | Regenerates icons and startup images (needs Playwright's WebKit).                               |

The first run of the e2e tests needs the browser: `npx playwright install webkit`.

The code is layered, and ESLint enforces it:

```
src/domain              pure logic, no imports from the rest
src/data                Dexie and repositories; nothing else may touch the database
src/platform            browser features: wake lock, sound, share, storage, updates
src/features, ui, app   screens and components; they read data only through repositories
```

Screenshot baselines for the Stats tab are in
`e2e/stats-visual.spec.ts-snapshots/` and belong to the machine that made them.
After an intended visual change, run
`npx playwright test e2e/stats-visual.spec.ts --update-snapshots` and look at the
new pictures.

## Deploy

The site is a project site on GitHub Pages at the path
`/workout-tracker-pwa/`. A push to `master` runs `npm run verify` and, if it
passes, publishes `dist/` (`.github/workflows/verify.yml`). The repository
settings need Pages, with the source set to GitHub Actions.

- The base path is set in `vite.config.ts` (`BASE_PATH` overrides it). Never
  write an absolute `/...` URL in app code or tests.
- GitHub Pages cannot set headers, so the Content-Security-Policy is a `<meta>`
  tag added at build time (`csp.ts`). Nothing is fetched from another origin.
- Deep links work through a copy of `index.html` served as `404.html`.
- The origin is part of the storage address. **If the URL ever changes, the app
  starts empty on the new one.** Save a backup first and restore it there.

### Updates

A new version is downloaded in the background and waits. Today and Settings
then show an Update button, and nothing reloads until it is tapped. The button
is not offered while a workout is in progress.

## Backup and restore

Your workouts exist only on your phone, so back them up.

- **Save a backup**: Settings, Save backup. On iPhone choose Save to Files. The
  file is named `workout-tracker-YYYY-MM-DD.json`. Today shows a reminder if the
  last backup is more than 14 days old.
- **Export sets as CSV**: Settings, one row per completed set, for spreadsheets.
- **Restore**: Settings, Import backup, choose the file, check the preview, then
  Merge (keeps both, the newer edit wins) or Replace (swaps everything, and
  offers to save a copy of the current data first). A file that is damaged or
  not from this app is refused and nothing is changed.
- **If the browser wipes its data**, the app notices on the next launch and
  offers a restore screen before anything else.

## Known limits

- iOS pauses web apps in the background, so the rest tone only plays while the
  app is open. The bar says so, and the screen-on setting helps.
- Persistent storage is requested at launch and shown in Settings, but iOS can
  still clear a web app's data under severe storage pressure. Back up.
- Weights are stored in kilograms.
