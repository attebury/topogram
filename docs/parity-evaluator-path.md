# Parity Evaluator Path

This is the fastest evaluator path for the repo's current parity story.

It ties together:

- web parity across three domains
- backend parity across three domains
- the exact emitted seams that matter
- one compact verification command

## What To Read

Start with:

- [docs/parity-proof-matrix.md](./parity-proof-matrix.md)
- [docs/multi-target-proof-issues.md](./multi-target-proof-issues.md)
- [docs/multi-runtime-proof-issues.md](./multi-runtime-proof-issues.md)

Then skim the repeatability notes:

- [docs/multi-target-proof-content-approval.md](./multi-target-proof-content-approval.md)
- [docs/multi-runtime-proof-content-approval.md](./multi-runtime-proof-content-approval.md)
- [docs/multi-target-proof-todo.md](./multi-target-proof-todo.md)
- [docs/multi-runtime-proof-todo.md](./multi-runtime-proof-todo.md)

## What To Verify

The current parity claim is seam-based, not source-text based.

The seams that matter are:

- `ui-web-contract` for web parity
- `server-contract` for backend/runtime parity

Representative emitted artifacts:

- `issues` web:
  [examples/generated/issues/artifacts/ui-web/proj_ui_web.ui-web-contract.json](../examples/generated/issues/artifacts/ui-web/proj_ui_web.ui-web-contract.json)
  and
  [examples/generated/issues/artifacts/ui-web/proj_ui_web_sveltekit.ui-web-contract.json](../examples/generated/issues/artifacts/ui-web/proj_ui_web_sveltekit.ui-web-contract.json)
- `issues` backend (OpenAPI):
  [examples/generated/issues/topogram/tests/fixtures/expected/openapi.json](../examples/generated/issues/topogram/tests/fixtures/expected/openapi.json)
- `content-approval` backend (OpenAPI):
  [examples/generated/content-approval/topogram/tests/fixtures/expected/openapi.json](../examples/generated/content-approval/topogram/tests/fixtures/expected/openapi.json)
- `todo` backend (server contract):
  [examples/generated/todo/topogram/tests/fixtures/expected/proj_api.server-contract.json](../examples/generated/todo/topogram/tests/fixtures/expected/proj_api.server-contract.json)

## What To Run

For the shortest repo-level parity proof, run:

```bash
bash ./scripts/verify-parity-matrix.sh
```

That command checks:

- web parity across `issues`, `content-approval`, and `todo`
- backend/runtime parity across `issues`, `content-approval`, and `todo`
- that the backend targets are actually different runtime realizations, not duplicated output under two names

The output is compact JSON so an evaluator or agent can read it quickly.

## What This Proves

- parity is not confined to one domain
- parity is not confined to one seam
- the current parity evidence is repeatable across three domains at both major emitted contract seams

## What It Does Not Prove

- broad parity across many more frontend or backend frameworks
- parity across every workflow shape or auth combination
- full independent verification beyond the generated proof stack
- production readiness of every generated target
