# Maintained Proof Checklist

## Goal

Use this checklist when adding a new hand-maintained proof under `product/app`.

The point is not to create another generated example.
The point is to prove that a hand-maintained app can stay aligned with emitted Topogram artifacts and fail clearly when it drifts.

## Checklist

1. Choose one emitted seam.

Good seams include:

- emitted OpenAPI or API contract fields
- emitted DB relation semantics
- emitted UI contract surfaces
- emitted canonical journeys
- emitted shape or screen summaries

2. Choose one maintained surface that mirrors that seam.

Examples:

- presenter summary output
- detail view model
- list/card summary
- action visibility
- route metadata
- form model

3. Add emitted-artifact assertions first.

Use helpers in:

- [product/app/scripts/emitted-contracts.mjs](/Users/attebury/Documents/topogram/product/app/scripts/emitted-contracts.mjs)

Prefer emitted artifacts over raw `.tg` source text when the emitted artifact already expresses the same meaning more cleanly.

4. Add maintained-behavior assertions second.

Put reusable scenario assertions in:

- [product/app/scripts/proof-scenarios.mjs](/Users/attebury/Documents/topogram/product/app/scripts/proof-scenarios.mjs)

The maintained assertions should answer:

- does the hand-maintained code still mirror the emitted seam?
- would this proof fail if the maintained behavior drifted?

5. Wire the proof through the three product-app gates.

Use:

- [product/app/scripts/compile-check.mjs](/Users/attebury/Documents/topogram/product/app/scripts/compile-check.mjs)
- [product/app/scripts/smoke.mjs](/Users/attebury/Documents/topogram/product/app/scripts/smoke.mjs)
- [product/app/scripts/runtime-check.mjs](/Users/attebury/Documents/topogram/product/app/scripts/runtime-check.mjs)

Typical split:

- `compile-check`: route and presenter contracts
- `smoke`: cheap behavior sanity checks
- `runtime-check`: emitted seam plus maintained proof scenario together

6. Add a no-go or drift story when the seam is safety-sensitive.

Examples:

- unsafe DB evolution
- ownership visibility drift
- workflow/UI ambiguity that should stay manual

Use a proof note under:

- [product/app/proof](/Users/attebury/Documents/topogram/product/app/proof)

7. Update the written proof story.

At minimum, update:

- [product/app/README.md](/Users/attebury/Documents/topogram/product/app/README.md)
- [product/app/proof/edit-existing-app.md](/Users/attebury/Documents/topogram/product/app/proof/edit-existing-app.md)

## Current Pattern

The maintained-proof structure is now:

- emitted artifact helpers
- proof scenarios
- one composed runtime gate

That split exists so the repo can answer two different questions clearly:

- what do emitted Topogram artifacts currently say?
- does the hand-maintained app still honor them?

## Current Examples

- `content-approval`
  - workflow-heavy maintained update proof
  - manual-decision and unsupported-change stories
- `todo`
  - contract, relation, journey, and list/detail visibility proof
- `issues`
  - ownership-gated detail actions and list/card visibility proof

## Rule Of Thumb

If a new proof would mostly duplicate a generated example, it probably belongs in generated example verification instead of `product/app`.

If a new proof is specifically about how hand-maintained code should respond to emitted Topogram change, it belongs here.
