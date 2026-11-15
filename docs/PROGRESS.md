# Progress

Running handover for the agent working through `PLAN.md`.

- **Current phase:** 3 (Exercise library), not started. Phases 0, 1 and 2 are complete. Phase 2's `[HUMAN]` tasks passed on 2026-11-15: GitHub Pages is live at `https://imkulwant.github.io/workout-tracker-pwa/`, and Kul confirmed on a real iPhone that the Home Screen app opens like a normal app, clears the status bar and home indicator, reports its storage state in Settings, and relaunches offline. Hosting is GitHub Pages (`DECISIONS.md` row 23), and there is no install gate (row 22).
- **Last verified commit:** see `git log`. `npm run verify` passes (15 test files, 269 tests) and `npm run test:e2e` passes (27 tests in iPhone WebKit). CI ran on GitHub: `verify` passed and the deploy worked once Pages was enabled.
- **Phase 2 notes for the next agent:**
  - Launch order is `ToastProvider` → `Boot` (persist, then seed) → router. The app runs in any browser tab, and a Home Screen shortcut opens it full-screen.
  - A browser tab and the Home Screen app have separate storage on iOS. Phase 6 backup and restore is how data moves between them.
  - The app is built for the subpath `/workout-tracker-pwa/`. Never write an absolute `/...` URL in app code, CSS or tests: it works on the dev server at `/` and 404s once deployed. E2E tests use relative paths such as `page.goto('history')`, because a leading slash drops the prefix.
  - E2E runs against `scripts/serve-pages.mjs`, which behaves like GitHub Pages: a path prefix, real 404s with no index fallback, and a `max-age=600` cache. The CSP is a `<meta>` tag injected at build from `csp.ts`, so any new asset type or inline style/script must satisfy it.
  - A push to `master` deploys, after `verify` passes (`.github/workflows/verify.yml`). Pushing publishes to the live app, so ask Kul first.
  - Real screens replace the placeholders in `src/app/routes.tsx`. `src/ui` components have only been verified through a throwaway harness (row 16), so Phase 3 screens are their first committed coverage.
  - Re-run `npm run icons` and update the startup links in `index.html` if the icon glyph or colours change.
- **Phase 1 notes still true:**
  - UI reads and writes data only through `src/data/repositories/*`. Metrics must read sets through `listCountableSets`.
  - Phase 3 still owes unique active exercise names (`DECISIONS.md` row 11).
  - Tests run in `Europe/Stockholm`. `seed.test.ts` parses the seed table out of `docs/PLAN.md`.
- **Known issues:**
  - 12 `npm audit` advisories, all dev-only and confirmed absent from every shipped file (`DECISIONS.md` rows 4, 7, 21). Re-run `npm audit` at Phase 9.
  - `typescript` is pinned to `~6.0.3` because `typescript-eslint` does not support 7 yet (row 5).
  - CI runs `verify` only, not e2e.
  - Playwright's WebKit reports persistent storage as "Not granted". That says nothing about iPhone behaviour.
  - `src/test/` is not in the plan's tree. It holds Vitest setup, fixtures and the IndexedDB smoke test.

## Log

- 2026-11-14: Repository already initialised on `master` with `origin` set. Plan moved to `docs/PLAN.md`.
- 2026-11-14: Phase 0 complete.
- 2026-11-14: Phase 1 complete.
- 2026-11-14: Phase 2 automated work complete.
- 2026-11-15: Install gate removed at Kul's request (`DECISIONS.md` row 22).
- 2026-11-15: Hosting moved from Cloudflare Pages to GitHub Pages (`DECISIONS.md` row 23).
- 2026-11-15: Phase 2 complete. Live site checked with `curl`, and Kul confirmed the iPhone checks.
