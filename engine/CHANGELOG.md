# Changelog

## Unreleased

- Install package-backed generator dependencies during `topogram template check`
  before starter validation.

## 0.3.16 - 2026-05-03

- Install package-backed generator dependencies during `topogram template check`
  before starter validation.

## 0.3.15 - 2026-05-03

- Carry package-backed generator dependencies from template packages into
  generated starter package devDependencies.

## 0.3.14 - 2026-05-03

- Add the bundled generator manifest/adapter interface so first-party stack
  generators dispatch through topology-bound generator manifests.
- Add explicit package-backed generator loading for installed packages with
  `topogram-generator.json` manifests and synchronous adapter exports.
- Document generator packs as the long-term boundary for reusable stack
  realization while templates compose generator IDs and optional implementation
  customizations.
- Make SvelteKit route generation contract-complete by default: generic route
  files are generated from the Topogram contract first, and template
  implementation providers may override specific route files.
- Emit SvelteKit `src/lib/topogram/generation-coverage.json` so generated apps
  record routed-screen coverage, implementation-vs-generator ownership,
  component rendering coverage, and diagnostics when projection intent is not
  realized.
- Emit the same generation coverage artifact for React apps so web generators
  share a common route and component coverage contract.

## 0.3.13 - 2026-05-01

- Add `topogram component check` as a user-facing alias for component
  conformance reports. The command prints a human summary by default, supports
  `--projection`, `--component`, and `--json`, and exits non-zero when
  conformance errors are present.

## 0.3.12 - 2026-05-01

- Add `component-conformance-report` generator target. The report compares
  `projection.ui_components` usage against component contracts, includes
  inherited shared-UI usages for concrete web projections, supports
  `--projection` and `--component` filters, and reports repair-oriented checks
  for missing required props, event action context, component status, approvals,
  write scope, and projection/component impact.

## 0.3.11 - 2026-05-01

- Add `domain` statement kind for grouping the spec by business slice
  (order fulfillment, billing, support, reporting, etc.). Identifier
  prefix `dom_`. Required fields: `name`, `description`, `status`.
  Optional: `in_scope`, `out_of_scope`, `owners`, `parent_domain`,
  `aliases`. Validator enforces identifier prefix, scope-list shapes,
  owner refs (`actor`|`role`), parent_domain refs, and parent-domain
  cycle detection.
- Add optional singular `domain` field on `capability`, `entity`, `rule`,
  `verification`, `orchestration`, `operation`, and `decision`. Cross-kind
  validator hard-errors on unknown ids and wrong-kind references.
- Resolver populates `resolvedDomain` on each tagged statement and a
  reverse-indexed `members` block on each `domain` (capabilities,
  entities, rules, verifications, orchestrations, operations, decisions).
- `context-slice --domain <id>` returns a focused subgraph
  (`focus.kind === "domain"`, members summarized, projections that
  realize any of its capabilities, plus a `domain_surface` review
  boundary). The same `--domain` selector flows through
  `verification-targets`, `change-plan`, `review-packet`, and the rest
  of the query family.
- `query domain-coverage --domain <id>` emits a per-platform realization
  matrix (capabilities × platforms) plus the projections involved.
- `query domain-list` lists all domains with member counts for navigation.
- New `domain-coverage` and `domain-page` generator targets. The latter
  emits markdown summaries at `topogram/docs-generated/domains/{slug}.md`
  per domain (members, in/out-of-scope, per-platform coverage table).
- `context-diff` now emits a `domains` section.
- `workspace-docs` recognizes a singular `domain:` frontmatter field on
  documents; the validator checks the reference.
- New docs: `docs/domains.md` (full guide); `docs/grammar.md` updated
  with the `domain` row and the optional-field paragraph;
  `docs/topogram-workspace-layout.md` appends a "Domain organization"
  subsection.
- New multi-domain fixture (3 domains, 10 capabilities, 12 entities, 4
  cross-platform projections) and golden tests at
  `engine/tests/active/domain-kind.test.js`.

### SDLC layer (Phase 2)

- Add five new SDLC statement kinds: `pitch` (`pitch_`), `requirement`
  (`req_`), `acceptance_criterion` (`ac_`), `task` (`task_`), and `bug`
  (`bug_`). Plus a markdown-only `document` (`doc_`) kind via
  `workspace-docs.js`. Each kind has its own status set, identifier
  pattern, required/allowed fields, and per-kind validator.
- Generalize `validateStatus` into a per-kind status table
  (`STATUS_SETS_BY_KIND`) so `decision` (existing) and the new SDLC
  kinds (`pitch`, `requirement`, `acceptance_criterion`, `task`, `bug`)
  each enforce their own status sequences.
- Extend existing kinds: `verification` gains `requirement_refs`,
  `acceptance_refs`, `fixes_bugs`; `decision` gains `pitch`,
  `supersedes`; `rule` gains `from_requirement`. All validate via the
  generalized cross-reference checker.
- Resolver builds 20+ new SDLC back-link arrays
  (`pitch.requirements`, `requirement.acceptanceCriteria`,
  `acceptance_criterion.tasks`, `task.blockingMe`, `bug.verifiedBy`,
  `rule.introducedByRequirements`, `rule.violatedByBugs`,
  `decision.introducedByTasks`, `capability.affectedByPitches`,
  `capability.affectedByRequirements`, `capability.affectedByTasks`,
  `capability.affectedByBugs`, etc.) so consumers can traverse the
  shape-the-work → ship → defect → verification chain without
  re-walking the graph.
- Extend `domain.members` with SDLC arrays (`pitches`, `requirements`,
  `tasks`, `bugs`, `documents`).
- Six new `context-slice` selectors: `--pitch`, `--requirement`,
  `--acceptance`, `--task`, `--bug`, `--document`. Each returns the
  same shape as existing slices (focus + summary + depends_on + related
  + verification + write_scope + review_boundary) with kind-appropriate
  review-boundary reasons (`pitch_scope`, `requirement_scope`,
  `task_scope`, `bug_scope`, `document_scope`).
- `context-diff` folds SDLC artifact changes into a new `sdlc` section
  covering pitch/requirement/AC/task/bug deltas.
- New `engine/src/sdlc/` core module: per-kind state machines under
  `transitions/`, per-kind DoD checks under `dod/`, history sidecar
  (`.topogram-sdlc-history.json`) for transition records, default-active
  status filtering, and a top-level orchestrator that surgically rewrites
  `.tg` `status` fields without disturbing surrounding formatting.
- New `engine/src/archive/` module: year-bucketed JSONL archive
  (`topogram/_archive/{kind}s-{year}.jsonl`), resolver bridge that
  auto-loads frozen entries at workspace-parse time so traceability
  still sees them, plus `archive` / `unarchive` / `compact` operations.
- New CLI subcommand group: `topogram sdlc transition <id> <status>`,
  `sdlc check`, `sdlc explain <id>` (with structured `next_action`
  output), `sdlc archive`, `sdlc unarchive`, `sdlc compact`,
  `sdlc new <kind> <slug>`, `sdlc adopt`, plus `topogram release`
  for atomic changelog assembly + document `app_version` stamping +
  archive trigger (with `--dry-run`).
- Four new generator targets: `sdlc-board` (kanban with `--kind`
  filter), `sdlc-doc-page` (rendered markdown per document with
  cross-ref sidebar), `sdlc-release-notes` (assembled from approved
  pitches + done tasks + verified bugs in a release window), and
  `sdlc-traceability-matrix` (pitch → req → AC → task/bug →
  verification table with gap detection).
- `workspace-docs` extended: 7 new `DOC_KINDS` (`user-guide`, `api`,
  `architecture`, `operations`, `getting-started`, `reference`,
  `development`); 3 new `DOC_STATUSES` (`review`, `published`,
  `archived`); `app_version`, `audience`, `priority`, `version`,
  `affects`, `satisfies`, `approvals` frontmatter fields.
- New docs: `docs/sdlc.md` (kinds, lifecycles, slices, release flow,
  agent-loop pattern), `docs/lifecycles.md` (per-kind state diagrams
  and DoD reference), and the SDLC layout subsection in
  `docs/topogram-workspace-layout.md`.
- New fixture `engine/tests/fixtures/workspaces/app-basic/` with one
  pitch + requirement + AC + task + bug + archived JSONL bug, plus 21
  golden tests at `engine/tests/active/sdlc-kinds.test.js` covering
  validators, resolver back-links, six new slice selectors, three
  generators (board/release-notes/traceability), state-machine
  transitions, DoD rules, archive load/save, transition round-trips
  (rewrite + history sidecar), and release dry-run output.
- Add `projection.ui_components` so projections explicitly own component
  placement and wiring. Component usage validates screen, region, component,
  prop, event, data-source, and event-target references.
- Remove `component.consumers` from the component grammar before external
  adoption; component usage now flows from projections instead of components
  self-registering consumers.
- Add structured component `behaviors { ... }` alongside the shorthand
  `behavior [...]`, with validation for supported stack-agnostic behavior
  kinds and behavior references to component props/events.
- Emit `approvals` and normalized `behaviors` in `ui-component-contract`
  artifacts.
- Include component usage metadata in generated UI contracts. Concrete web
  projections that realize a shared UI projection now inherit the shared
  projection's component usages and component contracts.
- Fix component diff impact for removed components by resolving projection
  impact from the baseline graph.

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
