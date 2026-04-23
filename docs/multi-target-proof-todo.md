# Multi-Target Proof: Todo

This note captures the third explicit multi-target proof in the repo.

The claim is narrow:

- one canonical `todo` Topogram
- one shared task, project, and user domain meaning
- two realized web targets
- semantic parity across those targets at the emitted UI contract seam

It is not yet a claim that broad multi-target generality is solved.

## Canonical Source

The proof starts from one canonical model:

- [examples/generated/todo/topogram](../examples/generated/todo/topogram)

That single package drives:

- shared task, project, and user UI semantics
- shared permission and ownership auth visibility semantics
- shared collection, board, calendar, and export surfaces

## Two Web Realizations

The current proof uses two web targets for the same `todo` model:

- React web via `proj_ui_web_react`
- SvelteKit web via `proj_ui_web`

Relevant outputs:

- React UI contract:
  [examples/generated/todo/topogram/tests/fixtures/expected/proj_ui_web_react.ui-web-contract.json](../examples/generated/todo/topogram/tests/fixtures/expected/proj_ui_web_react.ui-web-contract.json)
- SvelteKit UI contract:
  [examples/generated/todo/topogram/tests/fixtures/expected/proj_ui_web.ui-web-contract.json](../examples/generated/todo/topogram/tests/fixtures/expected/proj_ui_web.ui-web-contract.json)

This proof is intentionally anchored at the emitted UI-contract seam. It does not yet claim a committed second Todo app bundle beside the current SvelteKit-first app surface.

## What Must Stay The Same

The proof contract is semantic, not textual.

The two targets are expected to differ in generated source code and framework wiring. They are expected to stay aligned on:

- screen ids
- route set
- task list, board, calendar, detail, create, edit, and export surfaces
- primary, secondary, destructive, and screen action capability sets
- visibility predicates, including permission and ownership semantics
- key view and load capability surfaces for overlapping screens

If one target drifts on those emitted UI contract surfaces, the proof should fail.

## What This Proves

This proof strengthens the current claim in one specific way:

- web parity evidence now spans three different domains, not only the more heavily instrumented proof domains.

It does not yet prove:

- broad symmetry across many domains
- broad frontend coverage across many frameworks
- that every future domain will behave this cleanly across targets

## Current Verification Surface

The parity contract is locked in the engine regression suite:

- [engine/scripts/test.js](../engine/scripts/test.js)

That suite compares the emitted React and SvelteKit `todo` UI contracts directly, rather than comparing generated framework source code.
