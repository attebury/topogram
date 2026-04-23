# Agent Task Modes

Topogram should get easier to use when agents can work in explicit task modes instead of improvising their own operating model every turn.

The goal is not to add a second workflow. The goal is to make the existing context, boundary, and proof artifacts easier to apply consistently.

Terms in this doc follow the product glossary in [Topogram Product Glossary](./topogram-product-glossary.md), especially `task mode`, `slice`, `maintained boundary`, `seam`, `write scope`, and `verification targets`.

## Why Task Modes Matter

Agents do better when they know:

- what kind of work they are doing
- which context artifact to load first
- which files are in scope
- which reviews are likely to be required
- which verification pass is the smallest correct one

That is especially important now that Topogram already has:

- `context-slice`
- `context-bundle`
- `context-task-mode`
- maintained-boundary artifacts
- `adoption-plan.agent.json`
- explicit review classes

## Proposed First Modes

### 1. Modeling mode

Use when the task is primarily about changing canonical Topogram meaning.

Load first:

- `context-slice`
- `context-diff`
- `context-digest`

Write scope:

- canonical `topogram/**`
- optionally `candidates/**` for staged proposals

Review emphasis:

- entities and relations
- capabilities
- workflows and journeys
- projection semantics

Verification emphasis:

- the smallest verification targets covering the changed semantic surfaces

### 2. Maintained-app edit mode

Use when the task is changing human-owned application code that consumes emitted Topogram artifacts.

Load first:

- `context-bundle maintained-app`
- `maintained-boundary.json`
- linked maintained proof stories

Write scope:

- only maintained files explicitly listed in the maintained boundary artifact

Review emphasis:

- accepted vs guarded vs no-go maintained changes
- human-owned seams inside that maintained boundary
- places where product judgment is still required

Verification emphasis:

- `examples/maintained/proof-app/scripts/compile-check.mjs`
- `examples/maintained/proof-app/scripts/smoke.mjs`
- `examples/maintained/proof-app/scripts/runtime-check.mjs`

### 3. Import/adopt mode

Use when the task is about reuse from imported or inferred proposal surfaces.

Load first:

- `candidates/reconcile/adoption-plan.agent.json`
- reconcile report
- relevant `context-slice` or `context-bundle`

Write scope:

- `candidates/**` first
- canonical `topogram/**` only after an explicit adoption decision

Review emphasis:

- `accept`
- `map`
- `customize`
- `stage`
- `reject`

Verification emphasis:

- verify only the semantic surfaces that would become canonical after adoption

### 4. Diff review mode

Use when the task is understanding change impact before editing.

Load first:

- `context-diff`
- relevant `context-slice`
- maintained boundary artifact if maintained code is affected

Write scope:

- none by default

Review emphasis:

- affected generated surfaces
- affected maintained surfaces
- review-boundary changes
- verification coverage changes

### 5. Verification mode

Use when the task is proving or re-checking a known change.

Load first:

- `verification_targets` from slices or bundles
- maintained-boundary artifacts if applicable

Write scope:

- none by default unless fixing a discovered issue

Review emphasis:

- smallest correct check set
- proof coverage gaps
- maintained proof gates when human-owned code is involved

## Relationship To Write Scope

Task modes should not replace explicit write-scope contracts.

Instead:

- task mode selects the likely operating pattern
- write scope defines the actual file boundary for edits

A task mode is not a slice:

- task mode = operating pattern for the task
- slice = semantic focus surface plus dependency closure

## Relationship To Future MCP

Future MCP tools should be able to accept a task mode as a hint, then return:

- preferred context artifact
- write scope
- review boundary summary
- recommended verification targets

That would let agents and humans share one operating vocabulary without hiding local policy decisions.

## Relationship To Workflow Presets

Workflow presets should bind defaults onto these task modes. They should not redefine them.

That means:

- Topogram task modes remain the workflow grammar
- provider presets may add provider-specific workflow guidance
- team presets may add local workflow defaults
- external tools should consume the resolved machine-readable workflow context first, with tool-specific shims only if direct consumption later proves necessary
