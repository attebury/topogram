# Workflow Presets Plan

This note captures how Topogram should expose machine-readable workflow presets without turning Topogram into a tool-specific agent runtime.

## Summary

Topogram should keep its current planning and workflow model as the canonical, machine-readable workflow core.

That core already includes:

- task modes
- write scope
- review boundaries
- maintained boundaries
- verification targets
- `next-action`
- `single-agent-plan`
- `multi-agent-plan`
- `work-packet`

The right next layer is:

- `workflow presets`

These presets should be additive bindings onto the existing workflow core, not redefinitions of it.

The intended stack is:

1. Topogram workflow core
2. provider workflow preset
3. team workflow preset
4. resolved workflow context

Optional tool-specific shims may exist later, but only as convenience layers over the resolved machine-readable context.

## Core direction

Topogram should publish machine-readable workflow governance for external agent systems such as Cursor, Codex, or future MCP clients.

That means external tools should primarily consume:

- `query next-action`
- `query single-agent-plan`
- `query multi-agent-plan`
- `query work-packet`
- `query write-scope`
- `query verification-targets`
- `query change-plan`

Topogram should not try to become:

- a hosted agent scheduler
- a freeform agent messaging fabric
- a tool-specific orchestration runtime

## Workflow preset direction

A workflow preset should package defaults for using the Topogram workflow core in a particular context.

Examples:

- maintained-app hotfix review
- provider adoption review
- CI/deploy verification
- brownfield triage

A preset may specify:

- recommended task mode
- preferred queries
- artifact load order
- review escalation defaults
- verification policy
- multi-agent policy hints
- handoff defaults
- optional tool hints

A preset may not redefine:

- task-mode semantics
- review classes
- write-scope semantics
- serialized gates
- ownership boundaries

## Composition rules

Workflow presets should compose in this order:

1. Topogram workflow core
2. provider workflow preset
3. team workflow preset
4. resolved workflow context

Composition should be additive and safety-preserving:

- team presets may override additive defaults
- provider presets may contribute provider-sensitive guidance
- neither may weaken `manual_decision` or `no_go`
- neither may widen write scope beyond the core resolved scope

## Team presets

Team presets should be first-class local artifacts.

Their job is to capture local operating defaults such as:

- preferred load order for artifacts
- local blocker thresholds
- required vs recommended checks
- whether multi-agent decomposition is allowed
- what handoff fields a team expects

This lets teams use Cursor or similar tools differently without fragmenting the Topogram workflow model.

## Optional tool shims

Tool-specific adapters should not be a first-class requirement.

If Cursor or another tool can consume the machine-readable workflow artifacts directly, that should remain the preferred path.

A tool shim should only be added later if direct consumption proves awkward in practice.

If introduced, a shim should:

- be derived from resolved workflow context
- never become a second policy source
- never redefine workflow semantics

## Working rule

Topogram should own the workflow grammar.

Teams and providers may publish workflow presets.

External tools should consume the resolved machine-readable workflow context, with optional thin shims only if needed.
