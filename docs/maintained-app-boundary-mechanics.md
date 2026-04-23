# Maintained-App Boundary Mechanics

## Purpose

This note turns the current maintained-app philosophy into a more operational boundary model.

Terms here follow the product glossary in [Topogram Product Glossary](./topogram-product-glossary.md), especially `seam`, `slice`, `maintained boundary`, `ownership boundary`, `review boundary`, and `write scope`.

Topogram already says the right high-level things:

- canonical Topogram meaning is human-owned
- generated artifacts are engine-owned
- maintained code is human-owned
- agents may only touch maintained code within explicit boundaries

The current repo now implements the core seam-aware maintained boundary shape and operator surfaces.

What is still missing is the final import/adopt connection that answers:

- what emitted Topogram surfaces a maintained app is expected to follow
- which maintained modules implement those seams
- what kinds of changes are safe, review-required, manual-decision, or no-go
- how drift is detected when emitted semantics and maintained behavior diverge

This remains the long-lived layer between `change-plan`, brownfield `import-plan`, and hand-maintained application code.

`Slice` and `seam` are related but different:

- slice = semantic focus surface plus dependency closure
- seam = maintained alignment point where emitted semantics meet human-owned implementation

## Product framing

The maintained app is not just another example app.

It is the proof that Topogram can stay useful after generation or import, when the system is mostly human-owned and evolving over time.

That means the maintained boundary is the most durable operational relationship Topogram has with a real team:

- imports are episodic
- reconcile/adopt is periodic
- generation is rerunnable
- maintained boundaries are where day-to-day alignment actually lives

## Current state

Today the maintained boundary already exposes useful signals:

- `maintained_files_in_scope`
- `outputs`
- `emitted_artifact_dependencies`
- `human_owned_seams`
- `proof_stories`
- `ownership_boundary`

That is now enough for proof packaging and the main operator surfaces.

The current artifact is good at saying:

- these maintained files matter
- these maintained files can be grouped under governed outputs
- these proof stories are accepted, guarded, or no-go
- these seams stay human-owned

The remaining weakness is brownfield/import linkage:

- proposal surfaces do not start with canonical seam definitions
- inferred seam mappings must stay candidate-only until reviewed
- import/adopt review should expose those candidate mappings directly instead of only deriving maintained risk later
- candidate inference should stay conservative and evidence-based, requiring semantic overlap plus structural corroboration before a maintained seam is suggested

## Recommendation

Define maintained-app mechanics around `semantic seams first, files second`.

The primary contract should not be "this file is maintained."
It should be "this maintained area implements this semantic seam."

Then files and modules can be mapped to those seams.

This avoids a file-only boundary model that is easy to query but too weak to express actual product meaning.

## Proposed model

### 1. Boundary definition

Add a seam-oriented layer to the maintained boundary artifact.

Each seam should describe:

- `seam_id`
- `label`
- `kind`
- `status`
- `emitted_dependencies`
- `maintained_modules`
- `human_owned_aspects`
- `allowed_change_classes`
- `drift_signals`

Suggested seam kinds:

- `api_adapter`
- `ui_presenter`
- `workflow_affordance`
- `route_glue`
- `policy_interpretation`
- `verification_harness`

Suggested seam statuses:

- `aligned`
- `review_required`
- `manual_decision`
- `no_go`

These statuses should not replace review boundaries. They are seam-local operating state that should stay compatible with the existing review-boundary vocabulary.

### 2. Ownership classes

Keep the workspace-wide ownership boundary, but add seam-local ownership classes for operational use.

Suggested classes:

- `engine_owned`
- `contract_bound`
- `advisory_only`
- `out_of_bounds`

Interpretation:

- `engine_owned`
  Topogram may regenerate freely.
- `contract_bound`
  Humans own implementation, but the seam must stay aligned to emitted semantics.
- `advisory_only`
  Topogram may suggest updates, but local implementation choices dominate.
- `out_of_bounds`
  Topogram may identify impact, but should not patch or steer the seam directly.

For maintained-app work, most seams should likely be `contract_bound` or `advisory_only`.

This keeps ownership boundary and review boundary separate:

- ownership boundary answers who owns or may edit the seam
- review boundary answers how approval-sensitive a proposed change is

### 3. Allowed change classes

Each seam should declare which change classes are permitted.

Suggested classes:

- `safe`
- `review_required`
- `manual_decision`
- `no_go`

This should stay aligned with the existing review vocabulary rather than inventing a second classification system.

The difference is scope:

- review boundaries classify a proposed change
- seam mechanics define which classes a given maintained seam is willing to accept

That lets `change-plan` say not only "maintained code may be impacted," but also:

- which seam is implicated
- whether the seam is patchable
- whether the seam requires human product judgment
- whether the seam is beyond current maintained-app proof

### 4. Drift signals

Topogram should detect maintained drift at the seam level, not only by file inclusion.

Suggested drift signal types:

- `emitted_contract_changed`
- `visibility_or_policy_changed`
- `workflow_state_changed`
- `route_or_navigation_changed`
- `verification_expectation_changed`
- `manual_override_detected`

V1 drift reporting can stay conservative. It does not need to prove behavioral mismatch automatically.

It only needs to say:

- this seam is likely stale because one of its emitted dependencies changed
- this seam is review-sensitive because its proof story is guarded or no-go

## Artifact shape

This should extend the existing `maintained_boundary` artifact rather than replace it.

Suggested additive shape:

```json
{
  "type": "maintained_boundary",
  "version": 2,
  "summary": {
    "focus": "Maintained-app files, emitted constraints, and explicit review boundaries"
  },
  "maintained_files_in_scope": [
    "examples/maintained/proof-app/src/issues.js"
  ],
  "outputs": [
    {
      "output_id": "maintained_app",
      "kind": "maintained_runtime",
      "root_paths": ["examples/maintained/proof-app/**"],
      "maintained_files_in_scope": [
        "examples/maintained/proof-app/src/issues.js"
      ],
      "seams": [
        {
          "seam_id": "issues_detail_presenter"
        }
      ]
    }
  ],
  "emitted_artifact_dependencies": [
    "proj_api",
    "proj_web",
    "journey_issue_resolution_and_closure"
  ],
  "human_owned_seams": [
    "detail/list rendering treatment"
  ],
  "seams": [
    {
      "seam_id": "issues_detail_presenter",
      "label": "Issues detail presenter",
      "kind": "ui_presenter",
      "ownership_class": "contract_bound",
      "status": "review_required",
      "emitted_dependencies": [
        "proj_web",
        "journey_issue_resolution_and_closure"
      ],
      "maintained_modules": [
        "examples/maintained/proof-app/src/issues.js"
      ],
      "human_owned_aspects": [
        "detail/list rendering treatment"
      ],
      "allowed_change_classes": [
        "safe",
        "review_required"
      ],
      "drift_signals": [
        "workflow_state_changed",
        "visibility_or_policy_changed"
      ],
      "proof_stories": [
        "examples/maintained/proof-app/proof/issues-ownership-visibility-story.md"
      ]
    }
  ]
}
```

The current top-level fields should remain because they are still useful for broad context and proof packaging.

For multi-output repos, outputs should become the first grouping level:

- workspace
- outputs
- seams inside each output

That keeps seam reasoning precise when one semantic change affects only one governed code output.

`Write scope` should remain a separate task-facing surface. The maintained boundary explains what is governed; write scope explains which files are currently editable for a specific task.

## How `change-plan` should use this

The `maintained_impacts` section is now seam-aware.

Instead of only returning:

- maintained files in scope
- proof stories
- review sensitivity

it should also return:

- `affected_outputs`
- `affected_seams`
- seam ownership class
- seam status
- seam-level allowed change classes
- seam-level drift signals

That now lets `change-plan` answer better operational questions such as:

- what maintained seam moved?
- can the agent patch it directly?
- does this require product judgment?
- should we stop at explanation only?

## How agents should behave

Agent behavior should follow seam ownership and seam status together.

### `contract_bound`

- `safe`
  agent may patch inside declared maintained modules and then recommend verification
- `review_required`
  agent may prepare a bounded patch or proposal, but should make the review boundary explicit
- `manual_decision`
  agent should explain impact and propose options, but not choose UX/product treatment alone
- `no_go`
  agent should stop and point to the governing proof story or seam restriction

### `advisory_only`

- agent may identify affected modules and suggest changes
- agent should not assume emitted semantics fully determine local implementation

### `out_of_bounds`

- agent may report impact only
- no maintained-code edits

## How brownfield imports should connect

Imported apps should not create seam definitions as canonical truth automatically.

Instead, brownfield should infer candidate seam mappings such as:

- local component/presenter module appears to implement this UI seam
- local adapter appears to mirror this API contract
- local route/controller appears to realize this workflow affordance

Those should land in candidates for review and selective adoption, just like other imported meaning.

This keeps maintained boundaries aligned with the broader Topogram import/adopt model:

- infer
- stage
- map
- customize
- adopt

## Implementation path

### Implemented now

- `maintained_boundary` carries seam metadata, output grouping, ownership class, allowed change classes, and drift signals
- `change-plan` emits seam-aware `maintained_impacts`
- `maintained-drift`, `maintained-conformance`, `seam-check`, `risk-summary`, and `proceed-decision` all consume the seam-aware model

### Remaining next step

- brownfield/import should infer candidate seam mappings on proposal surfaces and carry them through reconcile review and `import-plan`
- those mappings should stay review-only and non-canonical until humans adopt them explicitly
- the scorer should favor precision over recall and be locked against real brownfield-derived regression fixtures, not only toy cases
- live proof now includes one positive imported proof case in `topogram-demo/examples/imported/supabase-express-api` alongside the negative/no-guessing `eshoponweb` imported proof

## Non-goals

This proposal does not imply:

- automatic maintained-app patching for all seam types
- full static proof of behavioral correctness
- replacing the existing proof stories
- replacing human review for product-sensitive maintained seams

The goal is narrower: make maintained boundaries operational enough that humans and agents can repeatedly use them during real change work.

## Bottom line

Topogram already has the right maintained-app philosophy.

The next step is to keep the maintained boundary legible as a seam contract while extending that same vocabulary into brownfield review:

- semantic seams first
- files and modules mapped second
- explicit allowed change classes
- conservative drift signals
- seam-aware agent behavior
- candidate seam mappings in import/adopt review
- precision-first seam inference proved on real brownfield-derived fixtures
- one positive live trial plus one negative live trial for brownfield maintained seam inference

That is the clearest path from maintained-app proof stories to repeatable maintained-app operations.
