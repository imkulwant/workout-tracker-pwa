# Decisions

Record every ambiguity resolved while implementing `PLAN.md`, and every runtime dependency added outside the plan's stack table.

| # | Date | Decision | Reason |
| --- | --- | --- | --- |
| 1 | 2026-11-14 | Project lives at the repository root, not in a `gym-tracker/` subfolder. | The repository is the project. The `gym-tracker/` root in the plan's tree maps to this repo root. |
| 2 | 2026-11-14 | Work is committed directly on `master`, locally only, one commit per task. | Chosen by Kul for the Phase 0 run. Nothing is pushed without a separate instruction. |
| 3 | 2026-11-14 | Add `@tailwindcss/vite` as a dev dependency alongside `tailwindcss`. | Tailwind 4 integrates with Vite through this plugin. It is build-time only and adds nothing to the runtime bundle. |
| 4 | 2026-11-14 | Keep `vite-plugin-pwa@2.0.0` despite 6 `npm audit` advisories (2 low, 4 moderate) and do not run `npm audit fix --force`. | All trace to `workbox-build` (deepmerge, glob, minimatch), which runs only at build time on our own config. The suggested fix downgrades to `vite-plugin-pwa@1.1.0`, which breaks the plan's "current stable release" rule. Re-check once Phase 2 configures the PWA, and revisit when `workbox-build` ships a patched release. |
| 5 | 2026-11-14 | Pin `typescript` to `~6.0.3` instead of the 7.0.2 the Vite template installed. | `typescript-eslint@8.72.2`, the latest stable, declares peer `typescript >=4.8.4 <6.1.0`. The plan says to use the newest compatible pair. `--force` was rejected because it would run the linter on a compiler it does not support. Revisit when a stable `typescript-eslint` supports TypeScript 7. |
| 6 | 2026-11-14 | Use ESLint (flat config) with `typescript-eslint`, and remove the template's `oxlint`. Enforce layer boundaries with ESLint's built-in `no-restricted-imports`. | The plan specifies ESLint. The built-in rule needs no extra plugin, which keeps the dependency count down. |
| 7 | 2026-11-14 | Accept 6 more `npm audit` advisories from `typescript-eslint` → `typescript-estree` → `minimatch` (12 total: 2 low, 10 moderate). | Same dev-only, build-time class as decision 4: lint tooling matching globs from our own config, never shipped to the device. Re-run `npm audit` at Phase 9 and before release. |
| 8 | 2026-11-14 | Rule 9 is enforced as: `src/app`, `src/ui` and `src/features` may not import `dexie` or `data/db`. They may import `data/repositories` and `data/backup`. | The plan says UI "must never touch Dexie tables directly" but Settings must call the backup functions, which are not repositories. Banning `dexie` and `db` stops direct table access without blocking backup. `dexie-react-hooks` stays allowed for `useLiveQuery` over repository queries. |
