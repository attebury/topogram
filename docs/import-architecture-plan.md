# Import Architecture Plan

## Summary

Refactor brownfield import into a dedicated `engine/src/import/` subsystem with pluggable extractors and enrichers.

The core rule is:

- framework-specific code only extracts or enriches evidence
- candidate normalization, gap reporting, reconcile, and adoption stay framework-agnostic

## Implemented Direction

The import system is now organized around:

- `engine/src/import/core/`
- `engine/src/import/extractors/`
- `engine/src/import/enrichers/`

The current CLI supports both:

- legacy workflow flags such as `--workflow import-app`
- explicit commands such as:
  - `import app`
  - `import docs`
  - `report gaps`
  - `reconcile`
  - `adoption status`

Adoption refresh is also supported for machine-managed canonical files:

- `reconcile adopt <selector> <path> --refresh-adopted --write`

This is intentionally narrow:

- it refreshes only previously adopted, machine-managed canonical files
- it uses the same candidate source path for the same adopted concept
- it does not turn reconcile into a general merge engine

## Architecture

### Shared Pipeline

All brownfield import should follow the same high-level flow:

1. discover sources
2. detect frameworks and source quality
3. run matching extractors
4. normalize to shared candidate records
5. dedupe and rank evidence
6. report gaps
7. reconcile into concept bundles
8. selectively adopt into canonical Topogram

Only detection and extraction should be framework-specific.

### Extractor Interface

Each extractor should implement:

- `id`
- `track`
- `detect(context) -> { score, reasons }`
- `extract(context) -> { findings, candidates }`

### Enricher Interface

Each enricher should implement:

- `id`
- `track`
- `applies(context, candidates)`
- `enrich(context, candidates)`

### Shared Candidate Contract

Every candidate should carry:

- `kind`
- `id_hint`
- `label`
- `confidence`
- `source_kind`
- `source_of_truth`
- `provenance`
- `track`
- importer-specific payload

Downstream reconcile and adoption should not depend on framework names.

## Source Priority

Default source priority should be:

1. canonical schema, route, page, or auth sources
2. framework-specific heuristics
3. generic fallback heuristics
4. generated artifacts only as fallback or corroboration

This is especially important for brownfield repos containing both source and generated copies.

## Standard Library Roadmap

Topogram should grow a standard library of extractors and generators around the shared candidate model and shared reconcile/adoption flow.

### Extractors

`db`

- Prisma
- SQL schema
- SQL migrations
- Drizzle schema
- Rails ActiveRecord schema
- Django ORM/models
- SQLAlchemy models
- DB snapshot/introspection

`api`

- OpenAPI
- Next.js `app/api`
- Next.js Pages Router API routes
- Express
- Fastify
- Hono
- NestJS controllers
- Rails routes/controllers
- Django REST Framework
- tRPC router inference
- GraphQL schema/resolvers
- generic route fallback

`ui`

- Next.js App Router
- Next.js Pages Router
- React Router
- SvelteKit
- Remix
- Vue Router / Nuxt
- Rails views/routes
- Django templates/routes
- generic route/file-system UI fallback

`workflows`

- capability/state inference from imported DB/API
- server actions
- auth/session flows
- job/queue workflows
- approval/state-machine inference
- test/spec-driven workflow extraction
- docs-driven workflow extraction

`docs`

- README scanner
- ADR/decision scanner
- PRD/spec scanner
- glossary/workflow markdown importer
- issue tracker / ticket import
- architecture docs importer

`runtime / deploy`

- Docker Compose
- Kubernetes manifests
- Terraform
- Fly.io / Vercel / Netlify configs
- CI pipeline configs
- env var/schema extractors

### Generators

`docs`

- glossary docs
- workflow docs
- decision summaries
- docs index
- adoption/reconcile summaries
- gap/drift reports

`contracts`

- JSON Schema
- OpenAPI
- GraphQL SDL
- API contract graphs
- UI contract graphs
- DB contract graphs

`backend`

- Hono server
- Express server scaffold
- Fastify server scaffold
- NestJS scaffold
- route handlers
- validation middleware
- auth/policy scaffolds
- runtime smoke checks
- compile/runtime check bundles

`frontend`

- shared UI contract
- web contract
- SvelteKit app
- Next.js app scaffold
- React app/router scaffold
- forms/detail/list screen scaffolds

`db`

- SQL schema
- Prisma schema
- Drizzle schema
- migration plans
- migration SQL
- schema snapshots
- lifecycle bundles

`ops`

- environment plans
- deployment plans
- app bundle plans
- smoke test plans
- CI checks
- local dev stack bundles

### Near-Term Priorities

Extractor priorities:

- Drizzle
- Express
- Fastify
- Next.js Pages Router
- tRPC
- GraphQL
- Docker Compose
- Terraform / Vercel / Fly configs
- ADR/spec doc importer

Generator priorities:

- Next.js app generator
- React Router app generator
- Express/Fastify server generator
- GraphQL schema generator
- CI/runtime-check generator
- deployment/env docs generator

## Architectural Rule

Framework-specific logic belongs in extractor and generator modules at the edges.

The shared core remains responsible for:

- candidate normalization
- source ranking
- dedupe and merge
- gap reporting
- reconcile bundle construction
- adoption planning
- selective canonical promotion

That keeps Topogram extensible without fragmenting the downstream model and adoption flow.
