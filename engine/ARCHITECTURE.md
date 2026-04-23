# Topogram Architecture

Topogram turns a `.tg` workspace into generated artifacts and apps through four layers:

1. `Topogram graph`
2. `realization`
3. `renderer`
4. `example implementation`

## Flow

1. `engine/src/parser` reads `.tg` files into an AST.
2. `engine/src/validator` validates statements and projection semantics.
3. `engine/src/resolver` produces a resolved semantic graph.
4. `engine/src/realization` derives target-ready realization objects from that graph.
5. `engine/src/generator` renders files, bundles, and runtime scaffolds from those realizations.
6. `examples/*/implementation` supplies domain-specific reference behavior that should not live in the generic engine.

## Boundaries

`engine/src/realization`
- Owns normalized semantic interpretation.
- Converts projections into stable realization objects.
- Should be domain-agnostic and projection-driven.

`engine/src/generator`
- Owns rendering and file emission.
- Consumes realization objects and generic generator inputs.
- Should be target-aware, not example-aware.

`examples/*/implementation`
- Owns example-specific runtime/reference behavior.
- Can include seed data, custom page renderers, repository implementations, and runtime-check specifics.
- Must not be treated as engine contracts.

## Stable Internal Contracts

The engine currently treats these realization types as stable internal interfaces:

- `ApiRealization`
- `DbRealization`
- `UiSharedRealization`
- `WebAppRealization`
- `BackendRuntimeRealization`

Renderers should consume these contracts instead of rediscovering domain meaning from raw statements.

## Proof Targets

The repo now uses three example shapes to pressure-test the architecture:

- `examples/generated/todo`: Postgres + SvelteKit reference app
- `examples/generated/issues`: multi-frontend proof with React and SvelteKit from one Topogram
- `examples/generated/content-approval`: workflow-heavy review domain

These examples are regression oracles. They are not part of the engine itself.
