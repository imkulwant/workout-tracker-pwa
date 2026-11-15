# Progress

Running handover for the agent working through `PLAN.md`.

- **Current phase:** 4 (Workout logging), not started. Phases 0 to 3 are complete. The live app at `https://imkulwant.github.io/workout-tracker-pwa/` still has the Phase 2 build: Phase 3 is committed locally and **not pushed**. Pushing deploys it, so ask Kul first.
- **Last verified commit:** see `git log`. `npm run verify` passes (16 test files, 312 tests) and `npm run test:e2e` passes (59 tests in iPhone WebKit).
- **Phase 3 notes for the next agent:**
  - The Exercises tab is real: library with search and body-part chips, create and edit form, detail screen with archive and restore, and `ExercisePicker` (a sheet, recent first, multi-select). Code is in `src/features/exercises/`.
  - **`src/features/workout/WorkoutScreen.tsx` is scaffolding.** It only hosts the picker so it can be tested, and saves nothing. Phase 4 replaces it with the real logger. Use `ExercisePicker`'s `onConfirm(exercises)` to add exercises to the active workout.
  - Exercise names are unique among active exercises, ignoring case (`DECISIONS.md` row 24). Creating, renaming and restoring all go through that check, and the form shows `DuplicateNameError` on the name field.
  - Pure logic lives in `src/domain/exercises.ts` (`filterExercises`, `splitRecent`, labels) and `src/features/exercises/formValues.ts`. Keep new logic there with unit tests, and keep components thin.
  - Sheets and dialogs focus their title on opening (row 27). The `ModalShell` change affects every sheet and dialog.
  - `listRecentExerciseIds` follows the `updatedAt` of workout exercises, so Phase 4 must write real `workoutExercises` rows for "recent first" to light up.
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
  - The `Toast` component is still only covered by the throwaway check from Phase 2. Phase 4's Undo toasts will be its first real use.
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
