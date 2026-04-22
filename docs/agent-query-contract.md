# Agent Query Contract

Topogram's first agent-query surface is local and artifact-backed.

The goal is not to make agents scrape Markdown or reload a full workspace every time. The goal is to let agents ask smaller, safer questions against generated JSON artifacts while local team policy remains the final authority.

Terms in this doc follow the product glossary in [Topogram Product Glossary](./topogram-product-glossary.md), especially `slice`, `seam`, `maintained boundary`, `ownership boundary`, `review boundary`, `write scope`, and `verification targets`.

## Current Backing Artifacts

The current local query contract is backed by:

- `context-digest`
- `context-slice`
- `context-bundle`
- `context-diff`
- `context-report`
- `candidates/reconcile/adoption-plan.agent.json`

These artifacts are engine-local today. They are also the intended backing model for a future MCP layer.

The next agent-experience layer should add:

- explicit task-mode selection
- explicit write-scope contracts
- explicit verification targeting

## Questions Agents Should Be Able To Answer

The artifact family should let an agent answer:

- what does this capability, workflow, projection, entity, or journey touch?
- what changed since another Topogram?
- what is human-owned?
- what is generator-owned?
- what maintained-app code is in scope?
- what needs review?
- what is staged vs accepted vs rejected in adoption planning?

## Proposed Future Tool Names

If this contract is exposed through MCP later, the first tools should map directly to the local artifact model:

- `get_context_slice`
- `get_context_diff`
- `get_review_boundary`
- `get_maintained_boundary`
- `get_adoption_plan`

The local CLI now exposes a matching thin query layer:

- `node ./src/cli.js query task-mode <path> --mode ...`
- `node ./src/cli.js query adoption-plan <path>`
- `node ./src/cli.js query maintained-boundary <path>`
- `node ./src/cli.js query maintained-conformance <path> [--from-topogram <path>]`
- `node ./src/cli.js query maintained-drift <path> --from-topogram <path>`
- `node ./src/cli.js query seam-check <path> [--seam <id>] [--from-topogram <path>]`
- `node ./src/cli.js query diff <path> --from-topogram <path>`
- `node ./src/cli.js query slice <path> --capability ...`
- `node ./src/cli.js query review-boundary <path> --capability ...`
- `node ./src/cli.js query write-scope <path> [--mode ...] [--capability ...] [--surface maintained-boundary]`
- `node ./src/cli.js query verification-targets <path> [--mode ...] [--capability ...] [--from-topogram ...]`
- `node ./src/cli.js query change-plan <path> [--mode ...] [--capability ...] [--from-topogram ...]`
- `node ./src/cli.js query import-plan <path>`
- `node ./src/cli.js query risk-summary <path> [--mode ...] [--capability ...] [--from-topogram ...]`
- `node ./src/cli.js query canonical-writes <path>`
- `node ./src/cli.js query proceed-decision <path> [--mode ...] [--capability ...] [--from-topogram ...]`
- `node ./src/cli.js query review-packet <path> [--mode ...] [--capability ...] [--from-topogram ...]`
- `node ./src/cli.js query next-action <path> [--mode ...]`
- `node ./src/cli.js query single-agent-plan <path> --mode ...`
- `node ./src/cli.js query multi-agent-plan <path> --mode import-adopt`
- `node ./src/cli.js query resolved-workflow-context <path> --mode ... [--provider <id>] [--preset <id>]`
- `node ./src/cli.js query workflow-preset-activation <path> --mode ... [--provider <id>] [--preset <id>]`
- `node ./src/cli.js query workflow-preset-customization <path> --provider <id> --preset <id>`
- `node ./src/cli.js query workflow-preset-diff <path> --provider <id> [--preset <id>]`
- `node ./src/cli.js workflow-preset customize <path> --provider <id> --preset <id> [--out <path>] [--write]`
- `node ./src/cli.js query work-packet <path> --mode import-adopt --lane <id>`
- `node ./src/cli.js query lane-status <path> --mode import-adopt`
- `node ./src/cli.js query handoff-status <path> --mode import-adopt`
- `node ./src/cli.js query auth-hints <path>`
- `node ./src/cli.js query auth-review-packet <path> --bundle <slug>`

## Expected Query Surfaces

### `get_context_slice`

Backed by `context-slice`.

Answers:

- focus surface
- dependency closure for that semantic slice
- related semantic surfaces
- verification coverage
- review boundary
- ownership boundary

### `get_context_diff`

Backed by `context-diff`.

Answers:

- changed semantic surfaces
- affected generated surfaces
- affected maintained surfaces
- affected verification coverage
- review-boundary changes
- ownership-aware change interpretation

### `get_review_boundary`

Backed by `context-slice`, `context-digest`, `context-bundle`, and `context-diff`.

Current review classes:

- `safe`
- `review_required`
- `manual_decision`
- `no_go`

These are advisory in v1. They are there to help humans and agents reason about review, not to silently block work.

### `get_maintained_boundary`

Backed by:

- `context-bundle maintained-app`
- `maintained-boundary.json`
- `maintained-boundary.context.json`

Answers:

- which maintained files are in scope
- which governed outputs are in scope and which seams belong to each output
- which emitted dependencies constrain them
- which proof stories define accepted, guarded, and no-go boundaries
- which seams stay human-owned within the maintained boundary
- which structured seam records define maintained modules, emitted dependencies, and allowed change classes

### `query maintained-drift`

Backed by:

- `context-diff`
- `context-bundle maintained-app`
- `context-task-mode --mode diff-review`

Answers:

- which maintained seams are currently affected by semantic drift
- which governed outputs contain those affected seams
- which maintained modules and emitted dependencies are implicated
- which verification targets belong to each affected output
- which seams are `review_required`, `manual_decision`, or `no_go`
- which maintained-aware verification targets should run next

This surface is diff-backed and should be used when the operator wants a maintained-app drift view rather than the full `change-plan` orchestration payload. In output-scoped repos, the payload groups seam drift under `outputs` while preserving the existing flat seam and file summaries.

### `query maintained-conformance`

Backed by:

- `context-bundle maintained-app`
- `context-task-mode --mode verification`
- `context-diff` when `--from-topogram` is provided

Answers:

- which governed seams currently appear `aligned`, `review_required`, `drift_suspected`, `no_go`, or `unverifiable`
- which governed outputs currently appear aligned or drift-pressured
- what evidence supports each seam's current conformance state
- which verification targets belong to each governed output
- which verification targets should run next
- what the current highest-severity conformance posture is

This surface is conservative in v1. `aligned` means no current governed evidence suggests drift. It does not imply full behavioral proof of maintained code. In output-scoped repos, the payload exposes per-output conformance summaries under `outputs` while preserving the aggregate top-level summary.

### `query seam-check`

Backed by:

- `context-bundle maintained-app`
- `context-task-mode --mode verification`
- `context-diff` when `--from-topogram` is provided

Answers:

- which seam-level probes currently pass or fail
- whether a seam currently looks `aligned`, `guarded`, `stale`, `no_go`, or `unverifiable`
- which output-level verification targets are attached to that seam
- whether lightweight implementation corroboration exists through maintained-module files, proof-story files, maintained-file scope, dependency-token matches, and seam-kind verification coverage

This surface is the probe-oriented companion to `maintained-conformance`. It now includes lightweight implementation-aware corroboration, but it still does not claim full behavioral understanding of maintained code.

## Canonical Seam-Aware Operator Path

For alpha, the shortest seam-aware operator path should be:

1. inspect governed outputs and seams
   - `node ./src/cli.js query maintained-boundary <path>`
2. inspect diff-backed maintained drift
   - `node ./src/cli.js query maintained-drift <path> --from-topogram <path>`
3. inspect seam conformance or seam probes
   - `node ./src/cli.js query maintained-conformance <path> --from-topogram <path>`
   - or `node ./src/cli.js query seam-check <path> --from-topogram <path>`
4. inspect orchestration
   - `node ./src/cli.js query change-plan <path> ...`
   - or `node ./src/cli.js query import-plan <path>`
5. inspect operator decision surfaces
   - `node ./src/cli.js query risk-summary <path> ...`
   - `node ./src/cli.js query proceed-decision <path> ...`
   - `node ./src/cli.js query review-packet <path> ...`

For import/adopt rehearsal:

- use the example workspace directly when staged reconcile artifacts already exist
- otherwise use [build-adoption-plan-fixture.mjs](/Users/attebury/Documents/topogram/engine/scripts/build-adoption-plan-fixture.mjs)
- for a non-empty staged proposal demo, use the `projection-impact` scenario

### `get_adoption_plan`

Backed by `candidates/reconcile/adoption-plan.agent.json`.

If a workspace does not already have staged reconcile artifacts, a deterministic local fixture can be built with:

`node ./engine/scripts/build-adoption-plan-fixture.mjs ./examples/content-approval/topogram --json`

For a fixture that also produces non-empty staged proposal surfaces, use:

`node ./engine/scripts/build-adoption-plan-fixture.mjs ./engine/tests/fixtures/import/incomplete-topogram/topogram --scenario projection-impact --json`

Current adoption states:

- `accept`
- `map`
- `customize`
- `stage`
- `reject`

`stage` is the non-canonical holding state. It means the proposal is still reviewable and queryable, but not yet promoted into canonical Topogram.

`query import-plan` now also carries additive seam-aware maintained information:

- `maintained_risk`
- per-proposal-surface `maintained_impacts`
- output-specific verification targets for affected maintained outputs
- `workflow_presets` for provider and team workflow guidance currently in scope
- `workflow_preset_surfaces` for adoptable provider workflow preset surfaces
- manifest-declared workflow preset exports and whether they have been imported yet
- per-surface `customization_status`, `recommended_local_path`, and `recommended_customization_action`

When `maintained_seam_candidates` are present, treat them as conservative, review-only inference:

- semantic overlap is the primary signal
- path and output corroboration can raise confidence
- ambiguous or weak evidence should produce no candidate rather than a speculative best guess
- the current live proof bar is one real positive trial (`trials/supabase-express-api`) plus one real negative/no-guessing trial (`trials/eShopOnWeb`)

That keeps import/adopt review aligned with the same maintained seam/output vocabulary used by the change-oriented operator surfaces.

### Future `get_task_mode`

This should answer:

- which mode best fits the requested task
- which context artifact to load first
- which write scope applies
- which verification targets are the smallest correct set

### Future `get_write_scope`

This should answer:

- safe-to-edit paths
- generator-owned paths
- human-owned review-required paths
- out-of-bounds paths

This is the file-boundary contract for a task, not the semantic focus surface.

### Future `get_verification_targets`

This should answer:

- smallest relevant generated verification set
- maintained proof gates when maintained code is in scope
- why those checks are the right next proof surface

This is the operator-facing check recommendation surface, not the same thing as proof itself.

### `query change-plan`

Backed by:

- `context-task-mode`
- `context-slice`
- `context-diff`
- `context-bundle maintained-app`

`change-plan` remains the canonical local query name for semantic change orchestration.

Answers:

- what semantic change is in scope
- which projections are affected
- which generator targets should run
- which maintained seams likely need review
- which governed outputs contain those maintained seams
- which verification targets belong to each affected output
- which seam records are affected, including ownership class, status, drift signals, and maintained modules
- which verification targets are the smallest correct proof set

This surface is advisory. It does not execute generators or enforce policy by itself. Maintained impacts are grouped by output when the maintained boundary exposes more than one governed code output.

### `query risk-summary`

Backed by:

- `change-plan` for change-oriented local work
- `import-plan` for staged import/adoption review

Answers:

- what the current overall operator risk is
- which seam-aware maintained outputs and seams contribute to that risk
- which maintained severity is highest
- which output-specific verification targets are relevant

For change-oriented work, this surface now includes `maintained_risk`, which is a compact seam-aware maintained summary rather than only a maintained-file count.

### `query proceed-decision`

Backed by:

- `risk-summary`
- `change-plan` or `import-plan`

Answers:

- whether the operator should proceed, proceed with review, stage only, or stop
- which seam-aware maintained risks are currently in scope
- which output-specific verification targets should follow

For change-oriented work, this surface now exposes `maintained_risk` and `output_verification_targets` in addition to the aggregate verification bundle.

### `query review-packet`

Backed by:

- `change-plan` or `import-plan`

Answers:

- the compact review-ready summary for the current operator decision
- the current `risk_summary`
- for change-oriented work, the `change_summary`, `maintained_impacts`, and `alignment_recommendations`
- which output-specific verification targets belong to the affected maintained outputs
- for import/adopt work, which provider and team workflow presets are currently in scope
- for import/adopt work, which provider workflow preset surfaces and refresh diffs still need review

The import/adoption packet shape stays narrower than the change-oriented packet, but it now carries `workflow_presets` as a separate category so provider workflow guidance can be reviewed without becoming a second workflow system.

When a provider workflow preset is marked `customize`, the canonical local destination for the derived team preset is:

- `workflow-presets/provider.<provider_id>.<preset_id>.json`

`topogram/workflow-presets/*.json` stays readable for backward compatibility, but `workflow-presets/` is the documented default for new local customizations.

### `query auth-hints`

Backed by:

- `candidates/reconcile/report.json`
- `candidates/reconcile/adoption-status.json`

Answers:

- which brownfield auth hints are unresolved, deferred, or adopted
- which bundles are currently high risk or stale high risk
- which auth-relevant role follow-up is still open
- which selector or follow-up step should happen next for auth-sensitive adoption work

### `query auth-review-packet`

Backed by:

- `candidates/reconcile/report.json`
- `candidates/reconcile/adoption-status.json`

Answers:

- the unresolved and deferred auth hints for one bundle
- the auth closure and auth aging state for that bundle
- which auth-relevant role follow-up still matters
- which projection patch actions are in scope
- which exact review and adoption steps should happen before `from-plan`

### `query single-agent-plan`

Backed by:

- `context-task-mode`
- reconcile/adoption artifacts when `--mode import-adopt`

Answers:

- the explicit default single-agent operating loop for one mode
- the current `next_action`, write scope, review boundaries, and proof targets
- which artifacts should be read first
- which steps are review-oriented vs directly executable
- which blockers are currently preventing progress
- the embedded `resolved_workflow_context`

`query next-action` stays the lightweight pointer. `query single-agent-plan` is the fuller default operating plan that future multi-agent decomposition should split into lanes and handoffs.

### `query resolved-workflow-context`

Backed by:

- `context-task-mode`
- optional accepted provider workflow presets under `candidates/providers/workflow-presets/*.json`
- optional active team workflow presets under `workflow-presets/*.json` or `topogram/workflow-presets/*.json`

Answers:

- which task mode applies after additive preset composition
- which queries and artifacts should load first
- which review blockers and escalation categories are currently effective
- which verification requirements are mandatory vs recommended
- whether multi-agent decomposition is allowed for the current task
- which presets were applied, skipped, or blocked by local activation policy
- which fields were resolved by which presets
- whether any invalid override attempts were ignored

This is the main machine-readable workflow-consumption surface for external tools. It is derived from the workflow core plus active provider and team workflow presets; it does not redefine the workflow core itself.

### `query workflow-preset-activation`

Backed by:

- `context-task-mode`
- provider workflow presets under `candidates/providers/workflow-presets/*.json`
- optional local team workflow presets under `workflow-presets/*.json` or `topogram/workflow-presets/*.json`
- optional provider manifests under `candidates/providers/manifests/*.json`

Answers:

- which workflow presets are active for the current task
- which presets were skipped and why
- which manifest-declared workflow presets are missing, imported, or invalid
- whether local activation rules, inactive flags, or manual-only settings narrowed the active set

This is the compact activation/explanation surface for operators who want to know why preset resolution did or did not pick a given preset.

### `query workflow-preset-diff`

Backed by:

- provider workflow presets under `candidates/providers/workflow-presets/*.json`
- local team workflow presets under `workflow-presets/*.json` or `topogram/workflow-presets/*.json`

Answers:

- whether a provider workflow preset is `new`, `unchanged`, `changed`, `locally_customized`, or `orphaned_customization`
- which workflow fields changed
- whether local customization overlaps those changes
- whether fresh review is required before continuing with provider adoption or refresh

This is the local diff-first refresh surface for provider workflow presets. It compares local imported provider preset state to local adopted/customized state only.

### `query workflow-preset-customization`

Backed by:

- provider workflow presets under `candidates/providers/workflow-presets/*.json`
- optional local team workflow presets under `workflow-presets/*.json` or `topogram/workflow-presets/*.json`

Answers:

- which provider workflow preset is being customized
- the canonical recommended local path for the derived team preset
- the `derived_from` provenance block, including the current source fingerprint
- a ready-to-write local `team_workflow_preset` scaffold
- which additive fields are the safest local customization points
- whether any warnings apply before creating or refreshing the local customization

This is a scaffold helper only. It does not write files by itself.

### `workflow-preset customize`

Backed by:

- `query workflow-preset-customization`

Answers or does:

- without `--write`, prints the same scaffold payload as the query
- with `--write`, creates the local team preset at the recommended path or `--out <path>`
- never mutates the imported provider preset
- refuses to overwrite an existing local customization implicitly

This is the narrow ergonomic helper for the `customize` adoption state. It exists so operators and external tools do not have to hand-author the local preset file shape.

Canonical customization loop:

1. inspect the provider workflow preset in `query import-plan` or import-backed `query review-packet`
2. inspect `query workflow-preset-activation` when you need to understand which presets are active, skipped, or missing from provider manifests
3. if the preset is marked `customize`, run `query workflow-preset-customization`
4. create the derived local team preset under `workflow-presets/`
5. review the local team preset like any other local Topogram artifact
6. use `query workflow-preset-diff` later to detect stale or orphaned customization
7. consume the active result through `query resolved-workflow-context` rather than reading raw preset files directly

### `query multi-agent-plan`

Backed by:

- `query single-agent-plan`
- `candidates/reconcile/report.json`
- `candidates/reconcile/adoption-status.json`
- `candidates/reconcile/adoption-plan.agent.json`

Answers:

- how `import-adopt` work can be decomposed into explicit review and execution lanes
- which workstreams are safe to run in parallel
- which gates must stay serialized
- which handoff packets should be published instead of relying on freeform agent messaging
- which overlap rules prevent competing canonical work
- the embedded `resolved_workflow_context`
- optional lane `workflow_context_overrides` when a lane narrows the shared context

This surface is intentionally limited to `--mode import-adopt` in v1. It is a decomposition of the default single-agent plan, not a separate planning philosophy.

### `query work-packet`

Backed by:

- `query multi-agent-plan`

Answers:

- what one worker may read first
- what one worker may touch
- which targets and review groups that lane owns
- which blocking dependencies must clear before work starts
- which proof targets remain attached to that lane
- which handoff packet the lane should publish
- which overlap and serialized-gate rules constrain that lane
- the embedded `resolved_workflow_context`
- lane-specific `effective_write_scope` and `effective_verification_policy`

This is the bounded assignment surface for one lane in the multi-agent plan. It stays artifact-backed and non-executing. It is not a scheduler contract or an agent-to-agent messaging layer.

### `query lane-status`

Backed by:

- `query multi-agent-plan`
- existing reconcile and adoption artifacts

Answers:

- which lanes are currently `ready`, `blocked`, or `complete`
- which lanes are blocking canonical adoption
- which lanes appear resolved enough to hand off

This is the lane-centric operator status surface. It stays artifact-backed and does not imply a live execution runtime.

### `query handoff-status`

Backed by:

- `query multi-agent-plan`
- existing reconcile and adoption artifacts

Answers:

- which handoff packets are `pending`, `blocked`, or `published`
- which source lane still needs work before a packet can be published
- which packets are ready for adoption or proof joins

This is the handoff-centric operator status surface. It exists to improve coordination visibility, not to replace review artifacts as the source of truth.

## Ownership Model

The query contract assumes the same ownership model used elsewhere in the repo:

- canonical Topogram is human-owned
- generated artifacts are engine-owned
- maintained code is human-owned
- proposal surfaces are human-owned but can be agent-assisted inside explicit review boundaries

## Non-Goals

This contract does not yet imply:

- hosted policy enforcement
- a live registry
- a live MCP server
- model-specific token accounting

Those can come later. The first priority is to keep the artifact model stable enough that local tools and future MCP can share one source of truth.
