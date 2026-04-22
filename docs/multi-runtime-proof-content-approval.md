# Multi-Runtime Proof: Content Approval

This note captures the second explicit multi-runtime proof in the repo.

The claim is narrow:

- one canonical `content-approval` Topogram
- one shared API and claim-aware auth meaning
- two generated backend runtime targets
- shared server-contract semantics across those targets

It is not yet a claim that broad backend/runtime generality is solved.

## Canonical Source

The proof starts from one canonical model:

- [examples/content-approval/topogram](../examples/content-approval/topogram)

That single package drives:

- shared API semantics
- shared workflow semantics
- shared claim-aware and ownership-aware authorization rules for the generated server targets

## Two Backend Realizations

The current proof uses two backend targets for the same `content-approval` model:

- Hono server via `hono-server`
- Express server via `express-server`

Relevant generated outputs:

- Hono server fixture:
  [examples/content-approval/topogram/tests/fixtures/expected/hono-server](../examples/content-approval/topogram/tests/fixtures/expected/hono-server)
- Express server fixture:
  [examples/content-approval/topogram/tests/fixtures/expected/express-server](../examples/content-approval/topogram/tests/fixtures/expected/express-server)
- Shared emitted server contract:
  [examples/content-approval/topogram/tests/fixtures/expected/proj_api.server-contract.json](../examples/content-approval/topogram/tests/fixtures/expected/proj_api.server-contract.json)

## What Must Stay The Same

The proof contract is semantic, not textual.

The two targets are expected to differ in framework wiring and request/response adapter code. They are expected to stay aligned on:

- route set
- request and response contract semantics
- success and error status surfaces
- authorization rules, including permission, claim, and ownership semantics
- generated server-contract meaning for the shared `proj_api`

If one backend target drifts away from that emitted server-contract seam, the proof should fail.

## What This Proves

This proof strengthens the current claim in one specific way:

- backend/runtime parity evidence is no longer confined to one domain.

It does not yet prove:

- broad symmetry across many backend runtimes
- broad framework coverage for all domains
- that all future workflow-heavy domains will behave this cleanly across backend targets

## Current Verification Surface

The parity contract is locked in the engine regression suite:

- [engine/scripts/test.js](../engine/scripts/test.js)

That suite checks that the `content-approval` Hono and Express bundles both build successfully and preserve the same generated `server-contract` semantics, while still remaining visibly different runtime targets.
