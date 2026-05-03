# Topogram Architecture

Topogram turns a `.tg` workspace into generated artifacts and apps through five layers:

1. `Topogram graph`
2. `realization`
3. normalized `contracts`
4. generator manifest + adapter
5. optional implementation provider

## Flow

1. `engine/src/parser` reads `.tg` files into an AST.
2. `engine/src/validator` validates statements and projection semantics.
3. `engine/src/resolver` produces a resolved semantic graph.
4. `engine/src/realization` derives target-ready realization objects from that graph.
5. `engine/src/generator` builds normalized contracts and resolves topology-bound generator manifests.
6. Bundled or package-backed generator adapters render stack-specific files.
7. Workspace `implementation/` modules supply project-specific reference behavior that should not live in the generic engine.

## Boundaries

`engine/src/realization`
- Owns normalized semantic interpretation.
- Converts projections into stable realization objects.
- Should be domain-agnostic and projection-driven.

`engine/src/generator`
- Owns contract emission, generator manifest validation, and file emission.
- Dispatches through topology-bound generator adapters.
- Should be contract-aware and stack-adapter-aware, not example-aware.

Generator adapters
- Own stack-specific realization such as React, SvelteKit, Hono, Express,
  Postgres, SQLite, Prisma, Drizzle, SwiftUI, or future Android files.
- Consume normalized contracts, topology component metadata, and optional
  implementation hooks.
- Return generated files and diagnostics through the shared generator interface.

Workspace `implementation/`
- Owns project-specific runtime/reference behavior.
- Can include seed data, custom page renderers, repository implementations, and runtime-check specifics.
- Must not be treated as engine contracts.

`component` statements live in the semantic graph beside entities, capabilities,
shapes, and projections. They produce `componentContract` resolver enrichment
and can be emitted through the `ui-component-contract` generator target without
requiring an implementation provider.

## Stable Internal Contracts

The engine currently treats these realization types as stable internal interfaces:

- `ApiRealization`
- `DbRealization`
- `UiSharedRealization`
- `WebAppRealization`
- `BackendRuntimeRealization`

Renderers should consume these contracts instead of rediscovering domain meaning from raw statements.

## Active Proof Targets

The active repo proof target is intentionally small:

- `engine/tests/fixtures/workspaces/app-basic`: engine-owned authoring-to-app fixture
- Private `topogram-demo-todo` repo: package-consumer generated app demo
