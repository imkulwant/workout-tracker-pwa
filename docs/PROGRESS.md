# Progress

Running handover for the agent working through `PLAN.md`.

- **Current phase:** 2 (App shell and iPhone deployment). All automated tasks are done and verified. **Waiting at the two `[HUMAN]` tasks:** create the Cloudflare Pages project and choose the final URL, then install on the iPhone and confirm checklist items 2 to 5 (item 1 was dropped, `DECISIONS.md` row 22). Phase 3 must not start until both pass.
- **Last verified commit:** see `git log`. `npm run verify` passes (15 test files, 277 tests) and `npm run test:e2e` passes (21 tests in iPhone WebKit).
- **Phase 2 notes for the next agent:**
  - Launch order is `ToastProvider` → `Boot` (persist, then seed) → router. There is no install gate (`DECISIONS.md` row 22): the app runs in any browser tab, and a Home Screen shortcut opens it full-screen.
  - A browser tab and the Home Screen app have separate storage on iOS. Phase 6 backup and restore is how data moves between them.
  - `vite preview` serves the `/*` block of `public/_headers`, so e2e runs under the production CSP. Any new asset type or inline style/script must satisfy it (`DECISIONS.md` rows 15, 19, 20).
  - Real screens replace the placeholders in `src/app/routes.tsx`. `src/ui` components have only been verified through a throwaway harness (row 16).
  - Re-run `npm run icons` and update the startup links in `index.html` if the icon glyph or colours change.
- **Phase 1 notes still true:**
  - UI reads and writes data only through `src/data/repositories/*`. Metrics must read sets through `listCountableSets`.
  - Phase 3 still owes unique active exercise names (`DECISIONS.md` row 11).
  - Tests run in `Europe/Stockholm`. `seed.test.ts` parses the seed table out of `docs/PLAN.md`.
- **Known issues:**
  - 12 `npm audit` advisories, all dev-only and confirmed absent from every shipped file (`DECISIONS.md` rows 4, 7, 21). Re-run `npm audit` at Phase 9.
  - `typescript` is pinned to `~6.0.3` because `typescript-eslint` does not support 7 yet (row 5).
  - Nothing has been pushed, so the GitHub Actions workflow has never run. CI runs `verify` only, not e2e.
  - Playwright's WebKit reports persistent storage as "Not granted". That says nothing about iPhone behaviour, which checklist item 4 measures.
  - `src/test/` is not in the plan's tree. It holds Vitest setup, fixtures and the IndexedDB smoke test.

## Log

- 2026-11-14: Repository already initialised on `master` with `origin` set. Plan moved to `docs/PLAN.md`.
- 2026-11-14: Phase 0 complete.
- 2026-11-14: Phase 1 complete.
- 2026-11-14: Phase 2 automated work complete. Waiting for the `[HUMAN]` tasks.
- 2026-11-15: Install gate removed at Kul's request (`DECISIONS.md` row 22).
