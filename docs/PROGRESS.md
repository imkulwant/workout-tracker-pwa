# Progress

Running handover for the agent working through `PLAN.md`.

- **Current phase:** 4 (Workout logging) is complete and verified in iPhone WebKit; Phase 5 (History and editing) is next. Phases 0 to 3 are pushed and live at `https://imkulwant.github.io/workout-tracker-pwa/`. **The Phase 4 commits are local and not pushed.** Pushing deploys them, so ask Kul first.
- **Last verified commit:** see `git log`. `npm run verify` passes (27 test files, 485 tests) and `npm run test:e2e` passes (111 tests in iPhone WebKit).
- **Phase 4 notes for the next agent:**
  - The logger is in `src/features/workout/`: `ActiveWorkoutScreen` (header with title, clock, Finish), `ExerciseCard` (options menu: reorder, replace, note, history, remove), `SetRow`, `RestBar`, `FinishDialog`, `WorkoutSummaryScreen`, `useWakeLock`, and `actions.ts` for multi-step actions (`addSetToExercise`, `startRestAfterSet`, `finishActiveWorkout`, `finishAtLastSet`, `discardWorkout`).
  - `LaunchGate` (`src/app/LaunchGate.tsx`) runs once per app load: a workout in progress sends you to `/workout`, and one started over 12 hours ago asks what to do. **An e2e test that reloads or does `page.goto` while a workout is active lands on `/workout`**, so navigate with the app's own links instead.
  - The summary lives at `/workout/:id/summary`. Phase 5's history detail should reuse its tiles. Records are not shown yet; Phase 7 adds them.
  - Shared e2e helpers are in `e2e/helpers.ts` (`startWith`, `logSet`, `card`, `ageActiveWorkout`, ...). Use `page.clock` for timers, and a fake `AudioContext` or `navigator.wakeLock` through `addInitScript` for platform features (see `rest-timer.spec.ts`, `workout-settings.spec.ts`).
  - A rest timer ends silently if it ended while the app was hidden, and the UI says alerts do not fire in the background (row 31). Per-exercise rest has no form field yet; `restSecondsFor` already reads `Exercise.defaultRestSec`, and template rest arrives in Phase 8.
  - Not done in Phase 4, by plan: never activating a waiting service worker during a workout (Phase 9).
  - Not verified on a real iPhone: the rest tone, the wake lock, and a force-quit relaunch. Ask Kul to try them after the push.
- **Phase 3 notes:**
  - The Exercises tab is real: library with search and body-part chips, create and edit form, detail screen with archive and restore, and `ExercisePicker` (a sheet, recent first, multi-select). Code is in `src/features/exercises/`.
  - The scaffolding `WorkoutScreen` was replaced by the real logger in Phase 4.
  - Exercise names are unique among active exercises, ignoring case (`DECISIONS.md` row 24). Creating, renaming and restoring all go through that check, and the form shows `DuplicateNameError` on the name field.
  - Pure logic lives in `src/domain/exercises.ts` (`filterExercises`, `splitRecent`, labels) and `src/features/exercises/formValues.ts`. Keep new logic there with unit tests, and keep components thin.
  - Sheets and dialogs focus their title on opening (row 27). The `ModalShell` change affects every sheet and dialog.
  - "Archived exercises stay in history" is verified only at the repository level until Phase 5 builds history (row 28).
  - E2E tips learned: use a regex anchored with `^` when a name is a substring of another ("Barbell Bench Press" vs "Incline Barbell Bench Press"); the toast area is also `role="status"`, so select the result count by `p[role="status"]`; a mutation that breaks the TypeScript build means the server never starts, so check a mutation really ran.
- **Phase 2 notes still true:**
  - Launch order is `ToastProvider` → `Boot` (persist, then seed) → router. The app runs in any browser tab, and a Home Screen shortcut opens it full-screen. A browser tab and the Home Screen app have separate storage on iOS.
  - The app is built for the subpath `/workout-tracker-pwa/`. Never write an absolute `/...` URL in app code, CSS or tests. E2E tests use relative paths such as `page.goto('history')`.
  - E2E runs against `scripts/serve-pages.mjs`, which behaves like GitHub Pages. The CSP is a `<meta>` tag injected at build from `csp.ts`.
  - A push to `master` deploys after `verify` passes (`.github/workflows/verify.yml`).
  - Re-run `npm run icons` and update the startup links in `index.html` if the icon glyph or colours change.
- **Phase 1 notes still true:**
  - UI reads and writes data only through `src/data/repositories/*`. Metrics must read sets through `listCountableSets`.
  - Tests run in `Europe/Stockholm`. `seed.test.ts` parses the seed table out of `docs/PLAN.md`.
- **Known issues:**
  - 12 `npm audit` advisories, all dev-only and confirmed absent from every shipped file (`DECISIONS.md` rows 4, 7, 21). Re-run `npm audit` at Phase 9.
  - `typescript` is pinned to `~6.0.3` because `typescript-eslint` does not support 7 yet (row 5).
  - CI runs `verify` only, not e2e.
  - `seedIfNeeded` does not check names, so a future seed version could add an exercise whose name a custom one already has (row 24).
  - The Undo toast can overlap the rest bar at the bottom of the workout screen.
  - `src/test/` is not in the plan's tree. It holds Vitest setup, fixtures and the IndexedDB smoke test.

## Log

- 2026-11-14: Repository already initialised on `master` with `origin` set. Plan moved to `docs/PLAN.md`.
- 2026-11-14: Phase 0 complete.
- 2026-11-14: Phase 1 complete.
- 2026-11-14: Phase 2 automated work complete.
- 2026-11-15: Install gate removed at Kul's request (`DECISIONS.md` row 22).
- 2026-11-15: Hosting moved from Cloudflare Pages to GitHub Pages (`DECISIONS.md` row 23).
- 2026-11-15: Phase 2 complete. Live site checked with `curl`, and Kul confirmed the iPhone checks.
- 2026-11-15: Phase 3 complete (local, not pushed).
- 2026-11-15: App renamed to "Workout Tracker" everywhere it is shown (`DECISIONS.md` row 29). The in-browser database name `gym-tracker` is kept on purpose. A Home Screen shortcut keeps the name it was added with, so it must be removed and added again to pick up the new one.
- 2026-11-15: Phase 4 complete (local, not pushed). Phase 3 and the rename were pushed and deployed earlier.
