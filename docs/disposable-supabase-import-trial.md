# Disposable Supabase Brownfield Import Trial

This branch adds a disposable verification path for `trials/supabase-express-api`.

It is intentionally **not** a permanent proof refresh. The helper copies the trial source into a temp workspace, strips the copied `topogram/` and `.git/`, then runs the full brownfield import/reconcile/adopt loop against that fresh copy.

After the initial `from-plan` pass, the helper also follows any `bundle-review:<slug>` next-best-action selectors surfaced by adoption status, rerunning `from-plan` after each approval step. That keeps the disposable trial aligned with the branch's current review-driven brownfield closure flow instead of assuming one `from-plan` pass is always enough.

## Run It

From the repo root:

```bash
bash ./scripts/run-disposable-supabase-trial.sh
```

Optional flags:

- `--temp-root <path>` to choose the temp workspace location
- `--keep` to preserve the workspace after success (default)
- `--cleanup` to remove the workspace after a successful run
- `--print-root` to print the final workspace root only

## What It Validates

The disposable trial treats success as process health, not historical exact counts.

Required contract:

- `topogram/candidates/reconcile/adoption-status.json` exists
- `next_bundle === null`
- `blocked_item_count === 0`
- `applied_item_count > 0`

It also checks that:

- DB and API import evidence are still present
- UI is reported explicitly as backend-only/no-UI
- canonical files exist under:
  - `topogram/entities`
  - `topogram/capabilities`
  - `topogram/shapes`
  - `topogram/decisions`
  - `topogram/docs/workflows`
- reconcile/adoption reporting still includes review-group signals for the imported flow

If the branch still cannot reach `next_bundle === null` after replaying the surfaced bundle-review steps, the helper fails and preserves the temp workspace so the remaining auth/review closure state can be inspected directly.

## Primary Inspection Files

Inspect these in the temp workspace after a run:

- `topogram/candidates/app/report.md`
- `topogram/candidates/docs/import-report.md`
- `topogram/candidates/reports/gap-report.md`
- `topogram/candidates/reconcile/report.md`
- `topogram/candidates/reconcile/adoption-status.json`
