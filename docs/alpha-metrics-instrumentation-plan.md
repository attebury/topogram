# Alpha Metrics Instrumentation Plan

This note turns the existing [Alpha Metrics Plan](./alpha-metrics-plan.md) into a concrete implementation follow-on.

The goal is still narrow:

- measure whether the alpha wedge is legible
- measure whether the maintained-app story is useful
- measure whether brownfield/import and proof surfaces are trustworthy enough

It is not a generic analytics program.

## Status

This work is intentionally deferred until after the alpha story, demo path, and closeout sweep are stable.

The reason is simple:

- Topogram first needs a stable evaluator path and proof spine
- then it needs a lightweight measurement loop around that stable path

For now, this should remain a tracked next-step workstream, not an alpha launch blocker.

## Instrumentation goal

The first instrumentation pass should make these metrics observable with low overhead:

- `time_to_wedge_comprehension`
- `demo_completion_rate`
- `artifact_confusion_count`
- `maintained_change_guidance_success_rate`
- `time_to_affected_seam_identification`
- `import_to_useful_model_rate`
- `closed_adoption_rate`
- `proof_freshness`

## Phase 1

Start with a manual, operator-friendly measurement loop.

Outputs:

- one short alpha session log template
- one weekly metrics review note
- one owner for collecting and summarizing evaluator/demo runs

Capture method:

- after each evaluator session or rehearsal, record:
  - date
  - session type
  - whether the canonical path completed cleanly
  - where confusion or claim drift occurred
  - which maintained seam or import/adopt step caused friction
  - whether proof artifacts were current

This phase should optimize for consistency, not precision.

## Phase 2

Add lightweight repo-backed instrumentation for the things that are easy to observe directly.

Good candidates:

- proof freshness checks against current docs and query paths
- deterministic fixture/demo command success tracking
- staged import/adopt demo health
- seam-aware query path health for the canonical maintained-app example

This phase should stay CLI- and doc-centered. It should not require product telemetry.

## Phase 3

Only after the first two phases are stable, decide whether alpha needs deeper measurement support such as:

- structured evaluator note capture
- lightweight scorecards for maintained-app usefulness
- more explicit brownfield trial outcome tracking

Do not build this until the simpler loop is working.

## Working rule

Alpha metrics instrumentation is ready to start when both of these are true:

- the canonical demo path is rehearsed and stable
- the seam-aware maintained and import/adopt proof paths are no longer changing week to week

Until then, the project should prefer proof clarity over measurement overhead.
