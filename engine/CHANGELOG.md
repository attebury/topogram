# Changelog

## 0.2.21 - 2026-04-29

- Add private catalog commands: `topogram catalog list`, `catalog check`, and
  `catalog copy`.
- Include catalog template aliases in `topogram template list`.
- Allow `topogram new --template <catalog-id>` to resolve package-backed
  template entries from the catalog.
- Keep pure topogram catalog entries non-executable in v1.

## 0.1.0 - 2026-04-15

Initial `v0.1` release candidate for the Topogram reference toolchain.

Highlights:

- parser, validator, and semantic resolver for the Topogram DSL
- typed semantic graph for the Todo reference domain
- JSON Schema, docs, API contract, OpenAPI, UI contract, DB contract, and debug generators
- shared UI semantics plus web realization and SvelteKit scaffold generation
- Postgres and SQLite DB projections
- DB schema snapshots, additive migration planning, Prisma and Drizzle schema generation
- repository scaffolds and Hono server generation
- DB lifecycle automation for greenfield bootstrap and brownfield migration
- local environment, deployment, smoke-test, compile-check, and polished app-bundle generation
- seeded demo data path for the generated Todo app golden path

Known boundaries:

- Prisma is the most complete generated runtime profile
- Drizzle runtime implementations remain scaffolds
- destructive or ambiguous DB migrations are intentionally manual
- deployment bundles are strong starting points, not turnkey production infrastructure
