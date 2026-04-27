# Multi-Target Proof: Content Approval

This note captures the second explicit multi-target proof in the repo.

The claim is narrow:

- one canonical `content-approval` Topogram
- one shared workflow and claim-aware auth meaning
- two realized web targets
- semantic parity across those targets at the emitted UI contract seam

It is not yet a claim that broad multi-target generality is solved.

## Canonical Source

The proof starts from one canonical model:

- [examples/generated/content-approval/topogram](../examples/generated/content-approval/topogram)

That single package drives:

- shared workflow semantics
- shared UI semantics
- shared claim-aware auth visibility semantics

## Two Web Realizations

The current proof uses two web targets for the same `content-approval` model:

- React web via `proj_ui_web__react`
- SvelteKit web via `proj_ui_web__sveltekit`

Relevant outputs:

- React UI contract:
  [examples/generated/content-approval/topogram/tests/fixtures/expected/proj_ui_web__react.ui-web-contract.json](../examples/generated/content-approval/topogram/tests/fixtures/expected/proj_ui_web__react.ui-web-contract.json)
- SvelteKit UI contract:
  [examples/generated/content-approval/topogram/tests/fixtures/expected/proj_ui_web__sveltekit.ui-web-contract.json](../examples/generated/content-approval/topogram/tests/fixtures/expected/proj_ui_web__sveltekit.ui-web-contract.json)
- React app fixture:
  [examples/generated/content-approval/topogram/tests/fixtures/expected/react-app](../examples/generated/content-approval/topogram/tests/fixtures/expected/react-app)
- SvelteKit app fixture:
  [examples/generated/content-approval/topogram/tests/fixtures/expected/sveltekit-app](../examples/generated/content-approval/topogram/tests/fixtures/expected/sveltekit-app)

## What Must Stay The Same

The proof contract is semantic, not textual.

The two targets are expected to differ in generated source code and framework wiring. They are expected to stay aligned on:

- screen ids
- route set
- workflow-heavy screen kinds and navigation surfaces
- primary and secondary capability actions
- screen action capability set
- visibility predicates, including claim and ownership semantics where present
- key view and load capability surfaces for overlapping screens

If one target drifts on those emitted UI contract surfaces, the proof should fail.

## What This Proves

This proof strengthens the current claim in one specific way:

- Topogram parity evidence is no longer confined to one best-case domain.

It does not yet prove:

- broad symmetry across many domains
- broad frontend coverage across many frameworks
- that all future workflow-heavy domains will behave this cleanly across targets

## Current Verification Surface

The parity contract is locked in the engine regression suite:

- [engine/scripts/test.js](../engine/scripts/test.js)

That suite compares the emitted React and SvelteKit `content-approval` UI contracts directly, rather than comparing generated framework source code.
