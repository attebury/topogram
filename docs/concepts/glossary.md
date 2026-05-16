# Glossary

Generated from `term` records in the Topogram workspace. Use `topogram emit glossary ./topo --write --out-dir docs/concepts` to refresh this file.

## Agent Workflow

### Agent Brief

A read-only onboarding packet that tells an agent what to read, which commands to run first, and which project boundaries matter.

- ID: `term_agent_brief`
- Domain: `dom_sdlc_query_agent_context`
- Aliases: `brief`, `first_run_packet`

### Agent Mode

A declared work posture such as modeling, implementation, review, verification, extract-adopt, maintained-app, generated-app, or release.

- ID: `term_agent_mode`
- Domain: `dom_sdlc_query_agent_context`
- Aliases: `task_mode`, `work_mode`
- Related terms: `term_context_slice`

### Context Slice

A focused graph packet for one capability, widget, projection, SDLC item, or related target, intended to be small enough for agent work.

- ID: `term_context_slice`
- Domain: `dom_sdlc_query_agent_context`
- Aliases: `focused_packet`, `slice`
- Related terms: `term_agent_brief`

## Extract/Adopt

### Adoption

The explicit promotion of reviewed extraction candidates into canonical topo source.

- ID: `term_adoption`
- Domain: `dom_import_adoption`
- Related terms: `term_candidate`

### Candidate

A review-only inferred record produced by extraction before it becomes canonical Topogram source.

- ID: `term_candidate`
- Domain: `dom_import_adoption`
- Aliases: `draft_candidate`
- Related terms: `term_adoption`, `term_extractor`

### Extractor

A read-only package or built-in adapter that inspects brownfield source and emits candidates, findings, and evidence.

- ID: `term_extractor`
- Domain: `dom_import_adoption`
- Aliases: `extractor_pack`

## Generation

### Emit

The command verb for printing or writing contracts, reports, snapshots, migration plans, and other named artifacts.

- ID: `term_emit`
- Domain: `dom_cli`
- Related terms: `term_generator`

### Generator

A package or bundled adapter that realizes Topogram contracts into app, runtime, API, database, or native output.

- ID: `term_generator`
- Domain: `dom_generator_runtime`
- Aliases: `generator_pack`

### Runtime

A topology unit such as a web surface, API service, database, or native surface that binds a projection to a generator.

- ID: `term_runtime`
- Domain: `dom_generator_runtime`
- Aliases: `topology_runtime`
- Related terms: `term_generator`

## Ownership

### Enforced Rule

A rule whose obligation currently applies to the project.

- ID: `term_enforced_rule`
- Domain: `dom_engine_quality`
- Aliases: `active_rule`

### Generated-Owned Output

Output that Topogram is allowed to replace from canonical contracts and generator bindings.

- ID: `term_generated_owned_output`
- Domain: `dom_workspace_project_config`
- Aliases: `generated_output`

### Maintained Output

Project source that humans or agents edit directly; Topogram can emit guidance but must not overwrite it.

- ID: `term_maintained_output`
- Domain: `dom_workspace_project_config`
- Aliases: `maintained_source`
- Related terms: `term_generated_owned_output`

## SDLC

### Acceptance Criterion

An observable Given/when/then proof condition attached to a requirement.

- ID: `term_acceptance_criterion`
- Domain: `dom_sdlc_query_agent_context`
- Aliases: `ac`, `acceptance`
- Related terms: `term_requirement`, `term_verification`

### Ongoing Requirement

A durable operating commitment that stays enforced through linked rules or verification rather than closing as satisfied.

- ID: `term_ongoing_requirement`
- Domain: `dom_sdlc_query_agent_context`
- Related terms: `term_enforced_rule`, `term_requirement`

### Pitch

An SDLC record that explains why a problem matters, the appetite for solving it, and traps to avoid.

- ID: `term_pitch`
- Domain: `dom_sdlc_query_agent_context`
- Aliases: `problem_framing`

### Requirement

An SDLC commitment that describes behavior or policy Topogram should satisfy until it is satisfied, superseded, or marked ongoing.

- ID: `term_requirement`
- Domain: `dom_sdlc_query_agent_context`
- Related terms: `term_acceptance_criterion`

### Task

A small implementation slice that satisfies requirements, references approved acceptance criteria, and closes with verification proof.

- ID: `term_task`
- Domain: `dom_sdlc_query_agent_context`
- Related terms: `term_acceptance_criterion`, `term_requirement`, `term_verification`

### Verification

A proof target or check that demonstrates an accepted expectation holds.

- ID: `term_verification`
- Domain: `dom_sdlc_query_agent_context`
- Aliases: `proof_gate`

## UI Widgets

### Surface

A concrete projection such as web_surface or ios_surface that realizes a platform-neutral contract for a target platform.

- ID: `term_surface`
- Domain: `dom_generator_runtime`
- Related terms: `term_ui_contract`

### UI Contract

The platform-neutral UI projection that owns screens, regions, widget bindings, navigation, behavior, and semantic design intent.

- ID: `term_ui_contract`
- Domain: `dom_generator_runtime`
- Related terms: `term_widget`

### Widget

A reusable semantic UI contract that can bind to screens and regions without naming a framework component tree.

- ID: `term_widget`
- Domain: `dom_generator_runtime`
- Aliases: `semantic_component`
