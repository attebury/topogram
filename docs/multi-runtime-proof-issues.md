# Multi-Runtime Proof: Issues

This note captures Topogram's first explicit multi-runtime proof for one domain.

The claim is narrow:

- one canonical `issues` Topogram
- one shared API and auth meaning
- two generated backend runtime targets
- shared server-contract semantics across those targets

It is not yet a claim that broad backend/runtime generality is solved.

## Canonical Source

The proof starts from one canonical model:

- [examples/generated/issues/topogram](../examples/generated/issues/topogram)

That single package drives:

- shared API semantics
- shared DB semantics
- shared permission and ownership auth semantics
- shared request, response, and authorization rules for the generated server targets

## Two Backend Realizations

The current proof uses two backend targets for the same `issues` model:

- Hono server via `hono-server`
- Express server via `express-server`

Relevant generated outputs:

- Hono server fixture:
  [examples/generated/issues/topogram/tests/fixtures/expected/hono-server](../examples/generated/issues/topogram/tests/fixtures/expected/hono-server)
- Express server fixture:
  [examples/generated/issues/topogram/tests/fixtures/expected/express-server](../examples/generated/issues/topogram/tests/fixtures/expected/express-server)
- Shared emitted API contract (OpenAPI):
  [examples/generated/issues/topogram/tests/fixtures/expected/openapi.json](../examples/generated/issues/topogram/tests/fixtures/expected/openapi.json)

## What Must Stay The Same

The proof contract is semantic, not textual.

The two targets are expected to differ in framework wiring and request/response adapter code. They are expected to stay aligned on:

- route set
- request and response contract semantics
- success and error status surfaces
- authorization rules, including permission and ownership semantics
- generated server-contract meaning for the shared `proj_api`

If one backend target drifts away from that emitted server-contract seam, the proof should fail.

## What This Proves

This proof strengthens the current claim in one specific way:

- Topogram is not only tied to one backend realization path for a given domain.

It does not yet prove:

- broad symmetry across many backend runtimes
- broad framework coverage for all domains
- that all future domains will behave this cleanly across backend targets

## Current Verification Surface

The parity contract is locked in the engine regression suite:

- [engine/scripts/test.js](../engine/scripts/test.js)

That suite checks that the `issues` Hono and Express bundles both build successfully and preserve the same generated `server-contract` semantics, while still remaining visibly different runtime targets.
