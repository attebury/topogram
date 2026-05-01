# Changelog

## 0.3.0 - 2026-05-01

- Add `component` statement kind for reusable UI/service component contracts
  (props, events, slots, patterns, regions, dependencies, consumers).
- Add `ui-component-contract` generator target that emits stable JSON per
  component or for the whole workspace; selectable via `--component <id>`.
- `context-diff` now emits a `components` section, and changed components
  fan out into `affected_generated_surfaces.projections` so consumer
  projections show up in diff payloads.
- `context-slice --component <id>` returns a first-class component slice with
  `focus.kind === "component"`, dependent shapes/projections/verifications,
  and a `component_surface` review boundary; the same selector flows through
  `verification-targets`, `change-plan`, `risk-summary`, `review-packet`,
  `proceed-decision`, `next-action`, `single-agent-plan`, and
  `resolved-workflow-context`.
- `topogram generate ... --generate ui-component-contract --component <id>`
  now errors loudly when the id does not match any component (previously it
  wrote a `null` artifact).
- Component prop defaults preserve real values: `default true`, `default false`,
  `default null`, integers, floats, quoted strings, and `default []` are all
  surfaced in the generated contract instead of collapsing to `null`.
- Add `docs/grammar.md` as the first authoritative reference for `.tg`
  statement kinds.

## 0.2.22 - 2026-04-29

- Record catalog provenance when `topogram new --template <catalog-id>` resolves
  a template alias to a package-backed template.
- Preserve the catalog alias/source in project template metadata, template file
  baselines, and executable implementation trust records.

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
