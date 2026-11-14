# Progress

Running handover for the agent working through `PLAN.md`.

- **Current phase:** 2 (App shell and iPhone deployment), not started. Phases 0 and 1 are complete.
- **Last verified commit:** `97be382`. `npm run verify` passes (12 test files, 251 tests) with every Phase 1 task ticked, and it passes on a clean clone.
- **Phase 1 notes for the next agent:**
  - UI reads and writes data only through `src/data/repositories/*`. Metrics must read sets through `listCountableSets`.
  - `seedIfNeeded()` exists but nothing calls it yet. Phase 2's app shell must call it at launch.
  - Phase 3 still owes unique active exercise names (`DECISIONS.md` row 11).
  - Tests run in `Europe/Stockholm`. `seed.test.ts` parses the seed table out of `docs/PLAN.md`, so editing that table updates the expected data.
- **Known issues:**
  - 12 `npm audit` advisories (2 low, 10 moderate), all dev-only. See `DECISIONS.md` rows 4 and 7. Re-run `npm audit` at Phase 9.
  - `typescript` is pinned to `~6.0.3` because `typescript-eslint` does not support 7 yet. See row 5.
  - The GitHub Actions workflow has not run, because nothing has been pushed.
  - CI runs `verify` only. Playwright e2e is local (`npm run test:e2e`, WebKit browser installed in the Playwright cache).
  - `src/test/` is not in the plan's tree. It holds the Vitest setup file and the IndexedDB smoke test.

## Log

- 2026-11-14: Repository already initialised on `master` with `origin` set. Plan moved to `docs/PLAN.md`.
