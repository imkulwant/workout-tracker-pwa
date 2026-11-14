# Decisions

Record every ambiguity resolved while implementing `PLAN.md`, and every runtime dependency added outside the plan's stack table.

| # | Date | Decision | Reason |
| --- | --- | --- | --- |
| 1 | 2026-11-14 | Project lives at the repository root, not in a `gym-tracker/` subfolder. | The repository is the project. The `gym-tracker/` root in the plan's tree maps to this repo root. |
| 2 | 2026-11-14 | Work is committed directly on `master`, locally only, one commit per task. | Chosen by Kul for the Phase 0 run. Nothing is pushed without a separate instruction. |
