# Topogram Workspace Layout

## Summary

Topogram should make the boundary between authored, generated, fixture, and deferred surfaces obvious from the file layout.

The goal is that a human or agent can answer three questions quickly:

- what is authored source of truth?
- what is generated and should be regenerated rather than hand-edited?
- what is an engine regression fixture rather than a user demo?
- what is deferred import, maintained, or brownfield proof material?

## Recommended Layout

### Active repo layout

- `engine/**`: Topogram engine implementation and engine tests
- `engine/tests/fixtures/workspaces/**`: engine-owned test workspaces
- `engine/tests/fixtures/expected/**`: engine-owned golden outputs
- `demos/generated/<domain>-demo-app/**`: user-facing generated app demos
- `examples/**`: legacy transition material retained while active demos move under `demos/**`

### Canonical Topogram surfaces

These are the durable, human-owned intent surfaces.

Typical layout:

- `topogram/*.tg`
- `topogram/docs/journeys/*.md`
- `topogram/docs/workflows/*.md`
- `topogram/docs/glossary/*.md`
- `topogram/docs/decisions/*.md`

Principle:

- if it defines enduring local meaning, it belongs here

### Candidate and draft surfaces

These are proposal surfaces produced by imports, reconcile, or agent assistance.

Typical layout:

- `topogram/candidates/**`
- `candidates/docs/**`
- `candidates/reconcile/**`

Principle:

- candidates are never canonical by default
- they should be reviewed, classified, and selectively adopted

### Generated artifact and proof surfaces

These are engine-owned outputs.

Typical layout:

- `artifacts/**`
- `app/**` inside user-facing demos
- generated contracts, bundles, digests, slices, reports, and verification outputs

Principle:

- these should be regenerated from canonical Topogram
- they are references and proof surfaces, not the main semantic source of truth

### Maintained application code

These are human-owned code surfaces that may consume generated artifacts without becoming generator-owned.

Typical layout:

- `examples/maintained/proof-app/**`
- maintained code under example apps when explicitly kept outside generator ownership
- hand-maintained adapters, presenters, routes, or UI glue around emitted contracts

Principle:

- this code may be edited by both humans and agents
- but it should not be treated as freely regenerable
- Topogram should define the boundary it needs to stay aligned with, not replace the ownership of the code itself
- maintained-app proof work is deferred during the generated-app reset

### Deferred imported proof material

`topogram-demo` and imported/brownfield proof docs are reference material during the current reset. They should not be required for quickstart, engine development, or generated app demos until `demos/imported/**` becomes active later.

## Ownership Model

The default ownership split should be:

- canonical Topogram: human-owned, agent-assisted
- candidate surfaces: agent-proposed, human-reviewed
- generated artifacts: engine-owned
- maintained code: human-owned, agent-editable within explicit review boundaries

This gives a clear operating model:

- humans approve durable meaning
- agents work in candidate and scoped-context layers
- the engine produces canonical realized outputs
- maintained code can evolve, but it stays outside generator ownership

## File-Level Guidance

When deciding where something belongs:

- put it in canonical Topogram if it expresses durable domain, workflow, or decision semantics
- put it in `candidates/` if it is imported, inferred, draft, or awaiting adoption
- put it in `artifacts/` or `apps/` if it is generated from the model
- keep it in maintained code if it is hand-owned application behavior that follows generated contracts without being generator-owned

When in doubt, prefer:

- canonical surfaces for stable meaning
- candidate surfaces for proposed meaning
- generated surfaces for realized meaning
- maintained code for human-owned implementation details and behavior seams

## Why This Matters

This layout is important for both humans and agents.

Humans need to know what they are actually approving.
Agents need to know what they may safely inspect, stage, refresh, or regenerate.

If these categories are not obvious in the workspace, Topogram risks mixing:

- source of truth
- proposed changes
- generated outputs
- maintained code ownership

That would make adoption, reuse, and proof much harder to trust.
