# Demo Path Confirmation Plan

This note captures how Topogram should confirm its alpha demo path or paths without expanding the alpha scope.

## Summary

Confirm one canonical alpha demo path optimized for a skeptical technical evaluator, then derive two lightweight variants for adjacent audiences without changing the underlying proof story.

The primary path should remain the current evaluator spine already reflected in [evaluator-path.md](/Users/attebury/Documents/topogram/docs/evaluator-path.md) and [alpha-plan.md](/Users/attebury/Documents/topogram/docs/alpha-plan.md):

- wedge
- maintained-app proof
- safe / guarded / no-go boundaries
- brownfield breadth
- limits

The work is to turn that from a documented path into a rehearsed, evidence-backed, operational demo system with explicit acceptance criteria.

## Primary direction

Use:

- one primary path
- two lightweight variants

Primary audience:

- skeptical technical evaluator

The two lightweight variants should be:

- design-partner / buyer variant
- internal rehearsal / operator variant

All variants should share one evidence spine. They should not become separate product stories.

## Canonical demo spine

The canonical sequence should be:

1. [README.md](/Users/attebury/Documents/topogram/README.md) for the wedge
2. [product/app/proof/edit-existing-app.md](/Users/attebury/Documents/topogram/product/app/proof/edit-existing-app.md) for maintained-app proof
3. one seam-aware maintained query sequence showing boundary, drift, and seam interpretation
4. one safe accepted change story
5. one guarded/manual-decision story
6. one no-go or rejected story
7. [confirmed-proof-matrix.md](/Users/attebury/Documents/topogram/docs/confirmed-proof-matrix.md) for brownfield breadth
8. one deterministic import/adopt fixture example with staged proposal surfaces
9. [proof-points-and-limits.md](/Users/attebury/Documents/topogram/docs/proof-points-and-limits.md) for the close

Treat this path as the only canonical evidence spine.

## What confirmation should mean

The demo path should count as confirmed only when:

- every referenced artifact exists and is current
- all links are valid
- each stop answers one clear evaluator question
- transitions between stops are clear and do not require invention during the demo
- the path can be delivered cleanly in 5-10 minutes
- the same path can expand into a longer technical conversation without changing the evidence spine
- the presenter can answer the top skeptical follow-up for each stop using existing repo materials
- the final close on limits matches current launch-facing claim boundaries
- the maintained-app segment can answer which seam moved, which output owns it, why it is safe / guarded / no-go, and which checks go with it

The confirmation pass should explicitly check for:

- duplicated concepts across stops
- weak or missing transitions
- stale evidence
- claim inflation
- steps that only make sense after reading later material

## Variant paths

### Design-partner / buyer variant

Purpose:

- communicate fit and credibility quickly without over-indexing on implementation detail

Shape:

- start with the wedge and good-fit framing
- show maintained-app proof quickly
- show brownfield breadth quickly
- end on limits and what alpha is for

### Internal rehearsal / operator variant

Purpose:

- make the primary path easy for teammates to run consistently

Shape:

- keep the same sequence as the primary path
- add timing guardrails
- add fallback cuts if time is short
- add presenter notes and recovery notes if a stop is confusing or stale

## Recommended artifacts

The demo-confirmation work should eventually produce:

- one canonical demo path doc
- one demo run sheet with timing and transition notes
- one demo readiness checklist
- one short objection-handling appendix pointing to existing proof docs
- one variant map showing how the two lightweight variants differ from the primary path

These should function as operator materials, not as new roadmap documents.

## Concrete run sheet

Use this as the default alpha rehearsal script.

### 1. Wedge

Target time:

- 30-60 seconds

Open:

- [README.md](/Users/attebury/Documents/topogram/README.md)

Say:

- Topogram's first credible job is controlled software evolution for humans and agents.

### 2. Maintained-app proof

Target time:

- 60-90 seconds

Open:

- [product/app/proof/edit-existing-app.md](/Users/attebury/Documents/topogram/product/app/proof/edit-existing-app.md)

Say:

- the maintained-app claim is seam-led, not just “some file changed”
- the key questions are which seam moved, which output owns it, and whether the change is safe, guarded, or no-go

### 3. Seam-aware maintained query sequence

Target time:

- 90-150 seconds

Run:

1. `node ./engine/src/cli.js query maintained-boundary ./examples/content-approval/topogram`
2. `node ./engine/src/cli.js query maintained-drift ./examples/content-approval/topogram --from-topogram ./examples/todo/topogram`
3. `node ./engine/src/cli.js query seam-check ./examples/content-approval/topogram --from-topogram ./examples/todo/topogram`

Call out:

- outputs and seams are explicit
- maintained drift is grouped by output and seam severity
- seam checks include lightweight implementation corroboration, not only governed metadata

### 4. Safe, guarded, and no-go

Target time:

- 60-90 seconds

Open:

- [issues-ownership-visibility-story.md](/Users/attebury/Documents/topogram/product/app/proof/issues-ownership-visibility-story.md)
- [content-approval-workflow-decision-story.md](/Users/attebury/Documents/topogram/product/app/proof/content-approval-workflow-decision-story.md)
- [issues-ownership-visibility-drift-story.md](/Users/attebury/Documents/topogram/product/app/proof/issues-ownership-visibility-drift-story.md)

Say:

- Topogram can say yes
- Topogram can say not yet
- Topogram can also say no

### 5. Brownfield breadth

Target time:

- 30-60 seconds

Open:

- [confirmed-proof-matrix.md](/Users/attebury/Documents/topogram/docs/confirmed-proof-matrix.md)

### 6. Import/adopt staged proposal demo

Target time:

- 60-90 seconds

Run:

1. `node ./engine/scripts/build-adoption-plan-fixture.mjs ./engine/tests/fixtures/import/incomplete-topogram/topogram --scenario projection-impact --json`
2. copy the returned `staged_topogram_root`
3. `node ./engine/src/cli.js query import-plan <staged_topogram_root>`

Call out:

- this produces a deterministic non-empty staged proposal demo
- the current happy path should show `staged_item_count: 9`
- the next action should be `review_staged`

### 7. Limits close

Target time:

- 30-60 seconds

Open:

- [proof-points-and-limits.md](/Users/attebury/Documents/topogram/docs/proof-points-and-limits.md)

Say:

- seam-awareness is evidence-backed and conservative
- it is not a claim of full semantic understanding of arbitrary maintained code

## Demo closeout checklist

The demo path is ready for alpha use when all of these are true:

- [README.md](/Users/attebury/Documents/topogram/README.md), [evaluator-path.md](/Users/attebury/Documents/topogram/docs/evaluator-path.md), and [proof-points-and-limits.md](/Users/attebury/Documents/topogram/docs/proof-points-and-limits.md) still tell the same wedge story
- the maintained query sequence runs exactly as written
- the import/adopt fixture path runs exactly as written
- the staged proposal demo remains non-empty
- the presenter can explain the difference between governed seam evidence and lightweight implementation corroboration
- the presenter can answer the multi-output question without improvising a new model
- the demo still fits inside 5-10 minutes with the maintained-app segment as the emotional center

## Rehearsal and signoff process

Use this sequence:

1. desk review of the docs-only path
2. one dry run with a presenter and one reviewer
3. one skeptical run where the reviewer plays a technical evaluator
4. final lock of sequence, timings, and allowed cuts

Signoff should require:

- no unresolved claim-boundary conflicts
- no stale evidence references
- one clean primary run
- one clean skeptical run

## Test scenarios

- validate the primary 5-10 minute path end to end
- validate that the primary path expands cleanly into a longer technical conversation
- validate that the design-partner variant stays within the same claim boundary
- validate that the operator variant is detailed enough for another teammate to run
- validate that every linked proof still supports the intended claim
- validate one maintained drift example
- validate one maintained conformance or seam-check example
- validate one import/adopt fixture example with non-empty staged proposal surfaces

## Assumptions

- the canonical audience for alpha remains the skeptical technical evaluator
- the maintained-app proof remains the emotional center of the demo
- brownfield breadth remains supporting proof, not the opening move
- limits remain part of the canonical close, not an optional appendix
- no new product capability is required to confirm the demo path
