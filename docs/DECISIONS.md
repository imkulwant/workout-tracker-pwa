# Decisions

Record every ambiguity resolved while implementing `PLAN.md`, and every runtime dependency added outside the plan's stack table.

| # | Date | Decision | Reason |
| --- | --- | --- | --- |
| 1 | 2026-11-14 | Project lives at the repository root, not in a `gym-tracker/` subfolder. | The repository is the project. The `gym-tracker/` root in the plan's tree maps to this repo root. |
| 2 | 2026-11-14 | Work is committed directly on `master`, locally only, one commit per task. | Chosen by Kul for the Phase 0 run. Nothing is pushed without a separate instruction. |
| 3 | 2026-11-14 | Add `@tailwindcss/vite` as a dev dependency alongside `tailwindcss`. | Tailwind 4 integrates with Vite through this plugin. It is build-time only and adds nothing to the runtime bundle. |
| 4 | 2026-11-14 | Keep `vite-plugin-pwa@2.0.0` despite 6 `npm audit` advisories (2 low, 4 moderate) and do not run `npm audit fix --force`. | All trace to `workbox-build` (deepmerge, glob, minimatch), which runs only at build time on our own config. The suggested fix downgrades to `vite-plugin-pwa@1.1.0`, which breaks the plan's "current stable release" rule. Re-check once Phase 2 configures the PWA, and revisit when `workbox-build` ships a patched release. |
