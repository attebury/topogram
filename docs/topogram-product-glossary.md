# Topogram Product Glossary

This glossary locks the main product terms Topogram uses across roadmap, alpha, import/adopt, proof, and package-sharing work.

The goal is not to define every possible DSL word. The goal is to stabilize the product language that humans and agents need in order to discuss Topogram clearly.

## Adopt

`Adopt` means promote reviewed candidate meaning into canonical surfaces.

Adoption is an explicit act. It should not happen implicitly just because an agent found, inferred, or imported something.

## Actor

`Actor` means a participant in a journey, workflow, or capability flow.

Actors describe participation, not permission.

Examples:

- user
- manager
- background job

## Agent

`Agent` means a human-directed software worker that uses Topogram context, boundaries, and verification surfaces to understand, propose, or make changes.

In Topogram, agent does not imply unrestricted autonomy. Agents should operate within write scope, ownership boundary, review boundary, and maintained boundary constraints, and should stop clearly at manual-decision or no-go surfaces.

## Artifact

`Artifact` means an engine-owned or generated output derived from canonical Topogram.

Artifacts are references, proof surfaces, or generated outputs. They are not the main semantic source of truth.

Examples:

- contracts
- docs indexes
- context bundles
- runtime bundles
- verification outputs

## Candidate

`Candidate` means proposed, inferred, imported, or draft material that is not yet canonical.

Candidates are reviewable proposal surfaces. They are meant to be inspected, classified, and selectively adopted.

Examples:

- candidate imports
- candidate reconcile bundles
- candidate docs
- candidate projection patches

## Canonical

`Canonical` means durable, approved source of truth.

Canonical surfaces define local meaning that should not be silently rewritten by agents or imports. In a Topogram workspace, canonical surfaces typically live under `topogram/**`.

Examples:

- canonical entities
- canonical workflows
- canonical journeys
- canonical projections

## Capability

`Capability` means a modeled action or operation the system can perform.

Capabilities are one of the core semantic building blocks that projections realize into API, UI, and other surfaces.

## Customize

`Customize` means start from imported or proposed meaning, but adapt it to local semantics before adoption.

Customization acknowledges that reusable meaning may be useful without being correct as-is.

## Generated Code

`Generated code` means engine-owned code or scaffolds that should usually be regenerated from canonical Topogram rather than hand-maintained.

The distinction between generated and maintained code is one of Topogram's main trust boundaries.

## Human

`Human` means the accountable teammate who reviews, directs, adopts, rejects, and owns product meaning and risky change decisions in a Topogram workflow.

Humans may work with agents, but they remain responsible for canonical adoption, review-sensitive interpretation, and decisions at manual-decision or no-go boundaries.

## Import

`Import` means collect and normalize candidate evidence from an external source.

The source may be:

- existing application code
- existing documentation
- a shared Topogram package

Import does not mean trust. Import should land in candidate space first.

## Journey

`Journey` means a user-goal-first reference artifact that explains what a participant is trying to accomplish end to end.

Journeys should help humans and agents understand change impact before drilling into workflows, rules, capabilities, and decisions.

## Maintained Boundary

`Maintained boundary` means the explicit contract that defines which maintained files, seams, emitted dependencies, and proof stories govern human-owned application code.

It is narrower than all maintained code and broader than a single file. It is the main operating surface for reasoning about maintained-app alignment, drift, and review-sensitive changes.

## Maintained Code

`Maintained code` means human-owned application code that consumes Topogram outputs without becoming generator-owned.

Maintained code may be edited by agents within explicit review boundaries, but it should not be treated as freely regenerable.

Examples:

- `product/app/**`
- hand-maintained presenters
- route glue
- adapters around emitted contracts

## Ownership Boundary

`Ownership boundary` means the line that says which surfaces are human-owned, engine-owned, proposal-only, or otherwise restricted.

Ownership boundary answers who is allowed to author, regenerate, review, or adopt a surface. It is distinct from review boundary, which classifies how risky or approval-sensitive a specific change is.

## Map

`Map` means connect imported or proposed meaning to an existing local concept instead of adopting it as a new canonical concept.

This is especially important for reusable Topogram packages and brownfield imports.

## Projection

`Projection` means a modeled realization surface for one concern or target.

Topogram projections describe how canonical meaning is expressed for a particular surface such as:

- API
- UI
- database

Examples:

- `proj_api`
- `proj_ui_shared`
- `proj_ui_web`
- `proj_db_postgres`

## Proof

`Proof` means evidence that Topogram can support a claim within a stated boundary.

Proof is narrower than “the feature exists.” It means there is concrete evidence that a claim holds in a meaningful scenario. It is distinct from verification targets, which tell humans and agents which checks to run now.

Examples:

- maintained-app proof
- brownfield proof
- compile, smoke, or runtime-check proof

## Provenance

`Provenance` means where a surface came from and how it reached its current state.

For imported or shared Topogram material, provenance should preserve source identity, version context, and candidate lineage so teams can review and refresh safely.

## Realization

`Realization` means the normalized, target-ready interpretation of Topogram semantics used to produce contracts, apps, or other outputs.

The engine realizes canonical meaning through projections into concrete artifacts.

## Reconcile

`Reconcile` means cluster candidate evidence into reviewable model, docs, and adoption surfaces.

Reconcile is where Topogram turns scattered evidence into bundles, reports, and adoption plans that humans and agents can review.

## Reject

`Reject` means explicitly decide that a candidate surface should not become canonical.

Rejection is a valid outcome, not a failure mode.

## Review Boundary

`Review boundary` means a class of change that should require explicit human review because it affects local product meaning or owned behavior.

Important review boundaries include:

- entities and relations
- workflows and journeys
- projections
- maintained-app seams
- imported package mappings

## Resolved Workflow Context

`Resolved workflow context` means the machine-readable result of applying the Topogram workflow core plus any adopted provider or team workflow presets for a specific task.

It is the main answer to questions like:

- which task mode applies?
- which artifacts should load first?
- what review boundaries matter now?
- what verification should run?

Resolved workflow context should also explain:

- which presets applied
- which presets were skipped
- which local policy or precedence rule won when presets disagreed

## Provider Workflow Preset

`Provider workflow preset` means additive workflow guidance published by a provider integration.

It may recommend task mode, query order, review escalation, verification defaults, multi-agent hints, or handoff defaults, but it must not redefine the Topogram workflow core.

## Preset Customization

`Preset customization` means deriving a local `team workflow preset` from an imported provider workflow preset instead of mutating the provider preset directly.

Customization is the canonical local adaptation path for provider workflow presets. The provider preset stays imported and intact; the local team preset carries the `derived_from` provenance and becomes the local override surface.

## Preset Resolution

`Preset resolution` means the deterministic composition of workflow core, provider workflow presets, team workflow presets, and local activation policy into one resolved workflow context.

Preset resolution should be conservative: it may narrow or tighten guidance, but it should not weaken write scope, review class, or proof expectations.

## Workflow Preset Activation

`Workflow preset activation` means the local decision logic that determines whether a workflow preset is active for a specific task.

Activation may consider:

- task class
- provider id or kind
- output scope
- query family
- inactive flags
- manual-only local policy narrowing

## Seam

`Seam` means the alignment point where emitted Topogram semantics meet human-owned implementation.

A seam is not just a file path. It is the maintained boundary point where a presenter, adapter, route layer, workflow affordance, or other hand-owned surface is expected to stay aligned with emitted contracts or modeled meaning.

Examples:

- maintained-app seam
- emitted UI contract seam
- server-contract seam

## Role

`Role` means an access or responsibility classification.

Roles describe permission or responsibility, not general participation.

Examples:

- author
- reviewer
- project owner

See also [Actors And Roles](./actors-and-roles.md).

## Rule

`Rule` means a durable business or system constraint that limits or explains allowed behavior.

Rules are part of canonical meaning and should be reviewed carefully because they often affect workflow and authorization semantics.

## Shared Topogram

`Shared Topogram` means a reusable Topogram package or export intended for use outside its original workspace.

Shared Topograms should be treated as untrusted semantic imports by default and should land in candidate space first.

See also [Shared Topogram Security Plan](./shared-topogram-security-plan.md).

## Slice

`Slice` means a focused semantic context view for one selected surface plus its dependency closure.

Slices help humans and agents load the smallest meaningful semantic area for a task without loading the full workspace graph.

Examples:

- capability slice
- entity slice
- workflow slice
- projection slice

## Stage

`Stage` means keep a proposal in a reviewable, non-canonical holding state.

Staged material is neither rejected nor adopted. It remains available for later review.

## Task Mode

`Task mode` means an explicit operating pattern that tells an agent what kind of work it is doing, which context to load first, which write scope applies, and which verification surfaces matter most.

Task modes help Topogram avoid improvising a fresh operating model on every turn.

Examples:

- `modeling`
- `maintained-app-edit`
- `import-adopt`
- `diff-review`
- `verification`

## Trust Boundary

`Trust boundary` means the line beyond which Topogram should not imply stronger confidence than the available proof supports.

Examples:

- proof-oriented auth vs production auth
- candidate import vs canonical adoption
- generated verification vs independent trust anchors

## ui_patterns

`ui_patterns` means semantic UI building blocks and composition intent, not framework components.

`ui_patterns` should describe what a screen is made of semantically so agents, generators, and imported Topograms can share reusable UI intent without binding canonical Topogram to React, Svelte, iOS, or Android implementation details.

Examples:

- `action_bar`
- `resource_table`
- `detail_panel`
- `activity_feed`
- `empty_state_panel`

See also [UI Patterns Plan](./ui-patterns-plan.md).

## Verification Targets

`Verification targets` means the smallest recommended proof and check set for the current semantic surface, slice, bundle, or task.

Verification targets help humans and agents choose the right compile, runtime, maintained-app, or proof checks after a change.

## Workflow Core

`Workflow core` means Topogram's canonical, machine-readable workflow grammar for software-governance work.

The workflow core includes things like task modes, write scope, review boundaries, maintained boundaries, verification targets, and planning surfaces such as `next-action`, `single-agent-plan`, `multi-agent-plan`, and `work-packet`.

It is tool-agnostic and should not be redefined by providers, teams, or external agent systems.

## Workflow Preset

`Workflow preset` means an additive bundle of workflow defaults that binds local guidance onto the Topogram workflow core for a particular class of work.

A workflow preset may recommend task mode, query order, review escalation, verification policy, handoff defaults, or tool hints. It does not redefine the workflow core itself.

Examples:

- provider workflow preset
- team workflow preset

## Wedge

`Wedge` means Topogram's first credible job-to-be-done.

The current wedge is:

- controlled software evolution for humans and agents

This is the framing the alpha should optimize for, rather than a broad “generate any product” claim.

## Write Scope

`Write scope` means the file-boundary contract that says which paths are safe to edit, generator-owned, human-owned review-required, or out of bounds.

Write scope is the main agent-facing answer to “where may I edit for this task?”

## Workflow

`Workflow` means a durable representation of system or business behavior across actions, transitions, and constraints.

Workflows describe how the system behaves. They are distinct from journeys, which describe what a user is trying to accomplish.
