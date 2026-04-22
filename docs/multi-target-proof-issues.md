# Multi-Target Proof: Issues

This note captures Topogram's first explicit multi-target proof.

The claim is narrow:

- one canonical `issues` Topogram
- one shared domain and auth meaning
- two realized web targets
- semantic parity across those targets at the emitted UI contract seam

It is not yet a claim that broad multi-runtime generality is solved.

## Canonical Source

The proof starts from one canonical model:

- [examples/issues/topogram](../examples/issues/topogram)

That single package drives:

- shared API semantics
- shared DB semantics
- shared UI semantics
- shared permission and ownership auth semantics

## Two Web Realizations

The current proof uses two existing web targets for the same `issues` model:

- React web via `proj_ui_web`
- SvelteKit web via `proj_ui_web_sveltekit`

Relevant outputs:

- React UI contract:
  [examples/issues/artifacts/ui-web/proj_ui_web.ui-web-contract.json](../examples/issues/artifacts/ui-web/proj_ui_web.ui-web-contract.json)
- SvelteKit UI contract:
  [examples/issues/artifacts/ui-web/proj_ui_web_sveltekit.ui-web-contract.json](../examples/issues/artifacts/ui-web/proj_ui_web_sveltekit.ui-web-contract.json)
- React app:
  [examples/issues/apps/web](../examples/issues/apps/web)
- SvelteKit app:
  [examples/issues/apps/web-sveltekit](../examples/issues/apps/web-sveltekit)

## What Must Stay The Same

The proof contract is semantic, not textual.

The two targets are expected to differ in generated source code and framework wiring. They are expected to stay aligned on:

- screen ids
- route set
- screen kinds
- primary and secondary capability actions
- screen action capability set
- visibility predicates, including ownership semantics
- key view and load capability surfaces for overlapping screens

If one target drifts on those emitted UI contract surfaces, the proof should fail.

## What This Proves

This proof strengthens the current claim in one specific way:

- Topogram is not only tied to one web realization path for a given domain.

It does not yet prove:

- broad symmetry across many runtimes
- full backend runtime diversity for the same domain
- that all future domains will behave this cleanly across targets

## Current Verification Surface

The parity contract is locked in the engine regression suite:

- [engine/scripts/test.js](../engine/scripts/test.js)

That suite compares the emitted React and SvelteKit `issues` UI contracts directly, rather than comparing generated framework source code.
