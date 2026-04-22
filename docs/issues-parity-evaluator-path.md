# Issues Parity Evaluator Path

This is the fastest evaluator path for the new `issues` parity proofs.

It ties together:

- web parity across React and SvelteKit
- backend parity across Hono and Express
- the exact emitted seams that matter
- one compact verification command
- one compact emitted-contract audit command

## What To Read

Start with:

- [docs/multi-target-proof-issues.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-issues.md)
- [docs/multi-runtime-proof-issues.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-issues.md)

Then verify the seams directly:

- UI seam:
  [examples/issues/artifacts/ui-web/proj_ui_web.ui-web-contract.json](/Users/attebury/Documents/topogram/examples/issues/artifacts/ui-web/proj_ui_web.ui-web-contract.json)
  and
  [examples/issues/artifacts/ui-web/proj_ui_web_sveltekit.ui-web-contract.json](/Users/attebury/Documents/topogram/examples/issues/artifacts/ui-web/proj_ui_web_sveltekit.ui-web-contract.json)
- API/runtime seam:
  [examples/issues/topogram/tests/fixtures/expected/proj_api.server-contract.json](/Users/attebury/Documents/topogram/examples/issues/topogram/tests/fixtures/expected/proj_api.server-contract.json)

## What To Run

For the shortest parity proof, run:

```bash
bash /Users/attebury/Documents/topogram/scripts/verify-issues-parity.sh
```

That command checks:

- React and SvelteKit preserve the same `issues` UI semantics
- Hono and Express preserve the same generated `server-contract` semantics
- the backend targets are actually different runtime realizations, not duplicated output under two names

The output is compact JSON so an evaluator or agent can read it quickly.

For the shortest emitted-contract audit, run:

```bash
bash /Users/attebury/Documents/topogram/scripts/audit-issues-contract-diff.sh
```

That command reads the emitted `issues` seams on disk and reports whether they differ semantically, without asking the reviewer to inspect generator internals.

## What This Proves

- one canonical `issues` model survives two web realizations
- the same canonical `issues` API semantics survive two backend runtime realizations
- the proof is anchored at emitted contract seams, not generated source-code text

## What It Does Not Prove

- broad parity across many domains
- broad parity across many frontend or backend frameworks
- full independent verification beyond the generated proof stack
- production readiness of every generated target
