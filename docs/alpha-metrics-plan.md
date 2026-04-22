# Alpha Metrics Plan

This note captures the small set of metrics Topogram should use for its invite-led alpha.

The goal is not to create a generic analytics program. The goal is to measure whether Topogram's alpha wedge is:

- legible
- useful
- trustworthy

## Summary

For alpha, Topogram should prioritize trust and legibility metrics over growth metrics.

The key question is not:

- how many people clicked something?

The key questions are:

- do evaluators understand the wedge quickly?
- does the maintained-app story actually help?
- does brownfield import produce useful candidate structure?
- do projections and generators help keep things aligned?
- does verification support the stated trust boundary?

## Metric groups

### 1. Evaluator comprehension

These metrics measure whether the alpha story is understandable.

Recommended metrics:

- `time_to_wedge_comprehension`
  - how long until a technical evaluator can correctly restate Topogram's first job
- `demo_completion_rate`
  - how often the canonical demo path is delivered cleanly without off-script rescue
- `artifact_confusion_count`
  - how often demos or evaluator sessions stall because an artifact is stale, unclear, or out of order
- `claim_boundary_violations`
  - how often presenters drift into claims that the proof docs do not support

### 2. Maintained-app usefulness

These metrics measure whether the central product wedge is working in practice.

Recommended metrics:

- `maintained_change_guidance_success_rate`
  - how often Topogram correctly classifies maintained-app changes as safe, review-required, manual-decision, or no-go
- `maintained_boundary_drift_detection_rate`
  - how often meaningful drift is caught before or during review
- `human_override_rate`
  - how often humans ignore or replace Topogram's maintained-app guidance because it is wrong or not useful
- `time_to_affected_seam_identification`
  - how quickly a human or agent can identify which maintained surfaces need updating after a semantic change

### 3. Brownfield import quality

These metrics measure whether the recovery story is producing useful structure.

Recommended metrics:

- `import_to_useful_model_rate`
  - how often import plus reconcile produces a candidate model worth reviewing
- `adoption_friction`
  - how many manual review, mapping, or cleanup steps are required before useful adoption
- `false_positive_candidate_rate`
  - how much junk candidate material is produced and later discarded
- `closed_adoption_rate`
  - how often a brownfield trial reaches a stable adopted state with no major blockers

### 4. Alignment and regeneration

These metrics measure whether projections and generators are helping rather than adding noise.

Recommended metrics:

- `affected_projection_accuracy`
  - how often the system correctly identifies which projections should move after a semantic change
- `selective_regeneration_success`
  - how often teams can regenerate only the needed surfaces without confusion or breakage
- `maintained_followup_rate`
  - how often maintained code still needs edits after regeneration
- `unexpected_downstream_change_count`
  - how often regeneration touches surfaces the team did not expect

### 5. Verification confidence

These metrics measure whether Topogram is trustworthy within its stated alpha boundary.

Recommended metrics:

- `recommended_check_accuracy`
  - how often the suggested verification set is sufficient for the change
- `post_change_failure_catch_rate`
  - how often tests or checks catch real alignment problems
- `proof_freshness`
  - how often demo and proof artifacts are current relative to the repo state
- `independent_trust_anchor_coverage`
  - what share of important claims rely on more than self-generated verification

## Small alpha metric set

If alpha starts with only a small set of tracked metrics, use these eight:

- `time_to_wedge_comprehension`
- `demo_completion_rate`
- `artifact_confusion_count`
- `maintained_change_guidance_success_rate`
- `time_to_affected_seam_identification`
- `import_to_useful_model_rate`
- `closed_adoption_rate`
- `proof_freshness`

These are the highest-signal measures for the current wedge.

## How to use these metrics

For alpha, each metric should eventually have:

- a plain-language definition
- a lightweight method of capture
- an owner
- a review cadence
- a rough “good enough for alpha” threshold

The process should stay lightweight. If measurement overhead becomes a project in itself, the metric system is too heavy for alpha.

## Working rule

If a metric does not help answer one of these questions, it is probably too early:

- do evaluators understand the wedge?
- does Topogram help with maintained-app evolution?
- does brownfield recovery produce useful structure?
- do projections and generators preserve alignment?
- does the proof story remain trustworthy within the current boundary?
