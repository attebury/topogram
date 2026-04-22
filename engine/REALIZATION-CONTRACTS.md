# Realization Contracts

This document freezes the minimum shape and invariants for the engine-owned realization layer.

## `ApiRealization`

Purpose:
- represent one capability as a transport-ready API contract

Minimum required fields:
- `capability.id`
- `endpoint.method`
- `endpoint.path`
- `endpoint.successStatus`
- `requestContract`
- `responseContract`
- `errors`

Invariants:
- path parameters must be represented in `requestContract.transport.path`
- body/query/header bindings must not require renderer inference
- precondition, idempotency, cache, authz, async, and download semantics live on `endpoint`

## `DbRealization`

Purpose:
- represent one DB projection as a normalized persistence contract

Minimum required fields:
- `projection.id`
- `engine`
- `profile`
- `tables`

Each table must include:
- `table`
- `entityId`
- `columns`
- `primaryKey`

Invariants:
- DB-family renderers must not rediscover table/column semantics from raw statements
- snapshots and migration plans derive from this realization, not directly from the AST

## `UiSharedRealization`

Purpose:
- represent platform-neutral screen/action/lookup semantics

Minimum required fields:
- `projection.id`
- `screens`

Each screen must include:
- `id`
- `kind`
- `title`

Optional but standard fields:
- `appShell`
- `navigation`
- `loadCapabilityId`
- `submitCapabilityId`
- `lookups`
- `actions`
- `emptyState`
- `filters`
- `pagination`
- `regions`
- `states`
- `patterns`

Invariants:
- shared UI realizations describe product semantics, not framework-specific file structure
- app shell, navigation, regions, states, and semantic patterns must be explicit enough that renderers do not infer them from example code

## `WebAppRealization`

Purpose:
- represent one web-ready app contract produced from shared UI plus web projection plus API semantics

Minimum required fields:
- `projection.id`
- `generatorDefaults`
- `contract.appShell`
- `contract.navigation`
- `contract.screens`
- `apiContracts`

Each screen must include:
- `id`
- `route`
- `kind`

Invariants:
- renderers must not infer domain nouns like `task`, `issue`, or `article`
- route, loader, submit, lookup, shell, navigation, and presentation wiring must already be explicit enough for React/Svelte renderers to emit files directly
- multiple web frontends should consume the same realization shape

## `BackendRuntimeRealization`

Purpose:
- represent one backend/runtime-ready contract from API + DB + example-owned backend reference

Minimum required fields:
- `apiProjection`
- `dbProjection`
- `contract.routes`
- `lookupRoutes`
- `repositoryReference`
- `backendReference`

Each route must include:
- `capabilityId`
- `method`
- `path`
- `repositoryMethod`
- `successStatus`

Invariants:
- backend renderers must not hardcode example nouns
- lookup routes must be derived from bindings, not guessed from entity names in renderer code
- DB projection selection must prefer explicit or example-owned defaults over engine hardcoding
