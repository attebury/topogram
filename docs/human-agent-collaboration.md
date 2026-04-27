# Human/Agent Collaboration Model

## Summary

Topogram should work as a shared system for humans, agents, and the engine itself.

The core rule is:

- humans own durable meaning
- agents operate on bounded working context
- the engine owns canonical realization and proof
- maintained code stays human-owned unless a narrower maintained boundary is declared explicitly

That separation keeps the system useful for automation without turning canonical Topogram into prompt-shaped drift.

## Collaboration Layers

### 1. Human-owned intent layer

Humans should primarily author, review, and approve the durable semantic surfaces:

- entities and important shapes
- capabilities
- rules
- decisions
- canonical workflows
- canonical journeys
- imported-package adoption decisions
- generated-vs-maintained boundaries

These are the surfaces where local meaning lives. They should not be silently rewritten by an agent.

### 2. Agent working layer

Agents should mainly operate on derived, scoped, or candidate surfaces:

- context digests, slices, bundles, and diffs
- draft Topogram edits
- candidate imports
- reconcile reports
- adoption plans
- draft docs, workflows, and journeys
- mapping suggestions for imported semantics

The normal pattern should be:

- propose
- explain
- review
- adopt

Agents are most useful when they reduce rediscovery and prepare good changes, not when they take ownership of semantic truth.

### 3. Engine-owned realization and proof layer

The engine should remain the canonical producer of:

- resolved graphs
- contracts
- generated apps and bundles
- verification plans and generated proof artifacts
- context-serving outputs

This is what makes Topogram deterministic, inspectable, and reusable across humans and agents.

### 4. Maintained code layer

Application code that is not generator-owned should remain human-owned by default.

That includes:

- hand-maintained presenters and route metadata
- hand-maintained UI composition and action logic
- maintained adapters around generated contracts
- local implementation details outside generator ownership

Agents may still edit this code, but the operating model should be:

- the Topogram and emitted artifacts define the boundary
- the agent proposes or applies changes inside that boundary
- the human remains responsible for approving meaning and maintained behavior

This is different from generated code:

- generated code is engine-owned and should usually be regenerated
- maintained code is human-owned and may only be updated with explicit review

## Review Boundaries

Human review should be required wherever a change affects local product meaning.

That especially includes:

- entity and relation changes
- workflow and journey changes
- projection behavior changes
- import mappings and customization
- maintained-app seams and no-go boundaries
- edits to maintained application code that interpret generated contracts

Important distinctions:

- ownership boundary says who owns a surface
- review boundary says how approval-sensitive a change is
- write scope says where edits are allowed for the current task

The agent may discover, `stage`, summarize, and classify these changes, but final adoption should stay explicit.

For machine-readable adoption planning, the intended vocabulary is:

- `accept`
- `map`
- `customize`
- `stage`
- `reject`

`stage` is the non-canonical holding state for a proposal that remains reviewable and queryable but is not yet adopted.

## Default Working Model

The intended collaboration loop is:

1. humans define or approve durable intent
2. agents gather scoped context and propose changes
3. the engine realizes contracts, generated artifacts, and proof
4. agents may update maintained code within explicit maintained-app boundaries
5. humans review semantic changes and maintained behavior deliberately

This is the collaboration model Topogram should optimize for, both in the local repo workflow and in future shareable Topogram package flows.

The default machine-readable operating surface should mirror that same loop:

- `query next-action --mode <mode>` stays the minimal pointer
- `query single-agent-plan --mode <mode>` is the explicit default operating plan for one agent or operator
- future multi-agent planning should be derived by decomposing that same single-agent plan, not by introducing a separate collaboration philosophy
- `query multi-agent-plan --mode import-adopt` should coordinate through structured lane ownership, handoff packets, overlap rules, and serialized gates rather than freeform agent messaging
- `query work-packet --mode import-adopt --lane <id>` is the bounded assignment surface for one worker, and should remain the preferred handoff boundary for external agent systems
- `query lane-status --mode import-adopt` and `query handoff-status --mode import-adopt` are the read-only visibility surfaces that let humans and agents see which lanes are blocked, ready, complete, or still waiting on handoffs
