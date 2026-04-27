# Steady-State Development Loop

This note captures the intended day-to-day operating loop for Topogram once a team is living with it over time.

The goal is to clarify where canonical Topogram, projections, generators, maintained code, and verification each fit in normal product development.

## Summary

Topogram should optimize for this steady-state loop:

1. change durable intent when meaning changes
2. determine affected projections
3. regenerate the affected emitted surfaces
4. update maintained code where the change crosses a maintained boundary
5. verify alignment

This means projections and generators are not the surfaces people will author most often. They are the alignment machinery that keeps durable meaning, emitted outputs, and maintained code from drifting apart.

## Core loop

### 1. Change durable intent

Humans or agents update canonical Topogram when local meaning changes.

Typical changes:

- add entity or field
- change relationship
- add or revise capability
- tighten a rule
- update workflow
- revise a journey

Canonical Topogram changes should remain relatively high-signal and meaning-oriented.

### 2. Determine affected projections

Projections answer:

- where does this change matter?
- which realized surfaces now need to move?

Examples:

- `proj_db_*` for schema or persistence impact
- `proj_api` for contract and server behavior impact
- `proj_ui_*` for UI, visibility, or state impact

This is the semantic impact-routing layer.

### 3. Regenerate affected emitted surfaces

Generators turn the canonical-plus-projection view into updated emitted truth.

Examples:

- schema or migration artifacts
- API contracts
- UI contracts
- generator-owned code or scaffolds
- context and proof artifacts

Generators are the deterministic realization step, not the main authoring surface.

### 4. Update maintained code

Humans or agents then update maintained application code where the emitted change crosses a maintained boundary.

Typical maintained changes:

- handlers
- presenters
- adapters
- route logic
- UI glue
- local tests

This is usually the most-lived-in part of the system over time.

### 5. Verify alignment

Verification should confirm that:

- canonical meaning is still valid
- emitted surfaces are up to date
- maintained behavior still follows the intended boundary

Typical checks:

- unit tests
- compile checks
- smoke checks
- runtime checks
- maintained-app proof checks
- contract or drift review

## What projections do

Projections are the semantic boundary layer.

They are not the thing most humans will edit every day. Their job is to define where canonical meaning must be expressed.

In practice, projections provide:

- impact routing
- surface ownership
- alignment definition

Without projections, Topogram can know that meaning changed, but not exactly which surfaces should move with it.

## What generators do

Generators are the deterministic realization layer.

They:

- consume canonical meaning plus projections
- emit concrete contracts, artifacts, bundles, and scaffolds
- keep humans and agents from hand-re-deriving every downstream surface

Generators are high-leverage, but not the center of day-to-day authoring.

## Common change patterns

### Entity or DB change

Typical flow:

- update entity, shape, or rule
- affect `proj_db_*`, and sometimes `proj_api` or `proj_ui_*`
- regenerate schema, migration, and contract artifacts
- patch maintained repositories, handlers, adapters, and tests
- run DB, compile, and smoke verification

### Capability or API behavior change

Typical flow:

- update capability, shapes, and sometimes workflow or rule
- affect `proj_api`, and sometimes `proj_ui_*`
- regenerate API contracts and related emitted surfaces
- patch maintained handlers, clients, adapters, and tests
- run unit, contract, and runtime-oriented verification

### UI or visibility change

Typical flow:

- update UI projection semantics or rule/capability semantics
- affect `proj_ui_shared`, shipped web projections (`proj_ui_web__*`), and sometimes `proj_api`
- regenerate UI contracts and related outputs
- patch maintained presenters, view logic, routes, and tests
- run UI-relevant compile, smoke, and maintained-app proof checks

### Workflow or business rule change

Typical flow:

- update workflow, rule, and possibly capability or journey
- affect API, UI, and sometimes DB projections
- regenerate affected contracts and proof artifacts
- patch maintained decision logic and tests
- run verification plus review-oriented proof checks

## Expected usage frequency

Over time, the parts of Topogram a team will use most often are likely to be:

- maintained code and tests
- verification commands
- canonical Topogram surfaces when meaning changes

The parts they will rely on heavily but author less often are:

- projections
- generators

So projections and generators are best understood as:

- high-leverage
- high-frequency in execution
- lower-frequency in direct authoring

## Product implication

If this is the right operating model, Topogram should optimize for:

- targeted projection impact reporting
- selective generator runs
- maintained-boundary drift detection
- recommended verification by change type
- agent guidance for where to patch maintained code after emitted surfaces move

This matters more than making projections themselves feel like the center of everyday work.

## Working model

The intended mental model is:

- canonical Topogram defines durable meaning
- projections define where that meaning must be expressed
- generators emit aligned downstream truth
- maintained code holds the long-lived human-owned implementation
- verification proves those layers still line up

In short:

- projections decide where a semantic change matters
- generators emit the new aligned surfaces
- maintained code absorbs the human-owned part of the change
- verification proves the system still lines up
