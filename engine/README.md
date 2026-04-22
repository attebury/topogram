# Topogram Engine

This folder contains the actual Topogram implementation.

Topogram reads `.tg` files, validates them, resolves them into a semantic graph, and generates downstream artifacts such as contracts, schemas, scaffolds, runtime bundles, and reference apps.

## Layout

- [src](./src): parser, validator, resolver, generator, and CLI
- [ARCHITECTURE.md](./ARCHITECTURE.md): engine/example boundary and layer model
- [REALIZATION-CONTRACTS.md](./REALIZATION-CONTRACTS.md): frozen realization interfaces and invariants
- [scripts/test.js](./scripts/test.js): dependency-free regression runner
- [tests/fixtures/invalid](./tests/fixtures/invalid): engine-specific invalid model cases
- [../examples/todo/topogram](../examples/todo/topogram): the current reference Topogram package
- [../examples/todo/topogram/tests/fixtures](../examples/todo/topogram/tests/fixtures): Todo-specific expected outputs and migration snapshots
- [../examples/todo/artifacts](../examples/todo/artifacts): generated contracts, docs, and runtime bundles for the Todo example
- [../examples/todo/apps](../examples/todo/apps): runnable generated runtimes for the Todo example
- [../examples/issues](../examples/issues): multi-frontend proof example
- [../examples/content-approval](../examples/content-approval): workflow-heavy proof example

## Architecture

- `src/realization`: builds normalized target-ready realizations from Topogram projections
- `src/generator`: renders files and bundles from those realizations
- `../examples/*/implementation`: owns example-specific implementation choices and reference renderers that should not live in the generic engine

The intended flow is:

1. parse and resolve Topogram into a semantic graph
2. build realizations from the graph
3. render artifacts and apps from those realizations
4. let the example package supply any domain-specific reference implementation behavior

The intended ownership model is:

- canonical `topogram/**` surfaces are human-owned, with agent assistance
- `candidates/**` surfaces are proposal layers for import, reconcile, and adoption work
- generated `artifacts/**` and `apps/**` are engine-owned realization and proof layers

This keeps source-of-truth semantics separate from draft and generated surfaces, which matters for both human review and agent automation.

### Refactor Boundaries

- `src/workflows.js`: orchestration only. New selector logic, review-group assembly, report rendering, and journey inference policy should live in extracted modules instead of drifting back here.
- `src/adoption/*`: adoption plan selection/state, review grouping/prioritization, and report/status rendering.
- `src/reconcile/*`: reusable reconcile-time policy and candidate document generation.
- `src/generator/apps/web/shared.js`: shared client, lookup, and visibility generation logic across web targets.
- `src/generator/runtime/bundle-shared.js`: shared bundle-merging and shell-script scaffolding only. Fixture-sensitive contract wrappers may stay specialized when exact output is part of the test contract.

## Working Agreement

- Treat `engine/` as Topogram itself.
- Treat `examples/todo/` as an example consumer of the engine.
- Keep engine-specific invalid test cases under `engine/tests/fixtures/invalid`.
- Keep Todo-specific fixtures with the Todo Topogram package.
- Keep Todo artifacts and runnable apps alongside the Todo example, not inside `engine/`.
- Keep the default human/agent loop as `propose -> review -> adopt`, rather than letting agents mutate canonical surfaces blindly.

## Commands

Run these from `./engine`.

```bash
npm run validate
npm run validate:issues
npm run validate:content-approval
npm run generate:docs:write
npm run generate:missing-journeys
npm run generate:app-bundle
npm test
```

Useful brownfield / journey commands:

```bash
node ./src/cli.js generate journeys /path/to/topogram --write
node ./src/cli.js reconcile adopt journeys /path/to/workspace --write
```

Useful brownfield auth-hint commands:

```bash
node ./src/cli.js reconcile /path/to/workspace
node ./src/cli.js reconcile /path/to/workspace --adopt projection-review:proj_api --write
node ./src/cli.js reconcile /path/to/workspace --adopt from-plan --write
```

Useful context-serving commands:

```bash
node ./src/cli.js ../examples/content-approval/topogram --generate context-digest --write --out-dir ../examples/content-approval/artifacts/context-digest
node ./src/cli.js ../examples/content-approval/topogram --generate context-slice --capability cap_request_article_revision
node ./src/cli.js ../examples/content-approval/topogram --generate context-bundle --task maintained-app
node ./src/cli.js ../examples/content-approval/topogram --generate context-diff --from-topogram ../examples/todo/topogram
node ./src/cli.js ../examples/content-approval/topogram --generate context-report --from-topogram ../examples/todo/topogram
node ./src/cli.js ../examples/content-approval/topogram --generate context-task-mode --mode maintained-app-edit
node ./src/cli.js query slice ../examples/content-approval/topogram --capability cap_request_article_revision
node ./src/cli.js query review-boundary ../examples/content-approval/topogram --capability cap_request_article_revision
node ./src/cli.js query write-scope ../examples/content-approval/topogram --capability cap_request_article_revision
node ./src/cli.js query verification-targets ../examples/content-approval/topogram --capability cap_request_article_revision
node ./src/cli.js query change-plan ../examples/content-approval/topogram --mode modeling --capability cap_request_article_revision --from-topogram ../examples/todo/topogram
node ./src/cli.js query import-plan ../examples/content-approval/topogram
node ./src/cli.js query risk-summary ../examples/content-approval/topogram --mode modeling --capability cap_request_article_revision --from-topogram ../examples/todo/topogram
node ./src/cli.js query canonical-writes ../examples/content-approval/topogram
node ./src/cli.js query proceed-decision ../examples/content-approval/topogram --mode modeling --capability cap_request_article_revision --from-topogram ../examples/todo/topogram
node ./src/cli.js query review-packet ../examples/content-approval/topogram --mode modeling --capability cap_request_article_revision --from-topogram ../examples/todo/topogram
node ./src/cli.js query next-action ../examples/content-approval/topogram --mode import-adopt
node ./src/cli.js query single-agent-plan ../examples/content-approval/topogram --mode import-adopt
node ./src/cli.js query multi-agent-plan ../examples/content-approval/topogram --mode import-adopt
node ./src/cli.js query work-packet ../examples/content-approval/topogram --mode import-adopt --lane auth_reviewer.article
node ./src/cli.js query lane-status ../examples/content-approval/topogram --mode import-adopt
node ./src/cli.js query handoff-status ../examples/content-approval/topogram --mode import-adopt
node ./src/cli.js query auth-hints ../examples/content-approval/topogram
node ./src/cli.js query auth-review-packet ../examples/content-approval/topogram --bundle article
node ./src/cli.js query maintained-boundary ../examples/content-approval/topogram
node ./src/cli.js query diff ../examples/content-approval/topogram --from-topogram ../examples/todo/topogram
```

These targets are for agent-facing structured context, not a replacement for docs or runtime verification:

- `context-diff`: semantic deltas across Topograms
- `context-slice`: one surface plus its dependency closure
- `context-digest`: compact machine digests for workspace and key semantic surfaces
- `context-bundle`: task-shaped bundles for `api`, `ui`, `db`, and `maintained-app`
- `context-report`: byte and line-count comparisons between full resolved graphs and served slices/bundles
- `context-task-mode`: agent operating guidance for `modeling`, `maintained-app-edit`, `import-adopt`, `diff-review`, and `verification`

The maintained-app surfaces now also expose machine-readable ownership and boundary artifacts:

- `maintained-boundary.context.json` from `context-digest`
- `maintained-boundary.json` alongside `context-bundle maintained-app`

The reconcile flow now emits a second agent-facing adoption view:

- `candidates/reconcile/adoption-plan.agent.json`

That artifact keeps `candidate` as workspace language, but uses the adoption-state vocabulary:

- `accept`
- `map`
- `customize`
- `stage`
- `reject`

`stage` is the non-canonical holding state for imported or proposed surfaces that still need review.

The next operating layer is now visible in the context artifacts too:

- `write_scope`: where an agent may safely edit, where generator-owned files live, and what stays review-required or out of bounds
- `verification_targets`: the smallest relevant generated and maintained proof checks for the current slice or bundle
- `change-plan`: the main alignment surface for semantic change, combining focus, ownership, projection impact, selective generator recommendations, maintained follow-up, and verification guidance

Together with future task modes, these should make agents more predictable in `modeling`, `maintained-app edit`, `import/adopt`, `diff review`, and `verification` work.

`query next-action` remains the smallest “what should I do now?” pointer. `query single-agent-plan` is the fuller default operating loop for one agent or operator, combining next action, write scope, review boundaries, proof targets, and primary artifacts. `query multi-agent-plan --mode import-adopt` is the optional decomposition of that same baseline into explicit lanes, handoff packets, overlap rules, and serialized gates for more complex brownfield review/adoption work. `query work-packet --mode import-adopt --lane <id>` is the bounded assignment surface for one lane, including allowed inputs, owned targets, blockers, proof expectations, and the handoff packet that lane must publish. `query lane-status` and `query handoff-status` are the operator-visibility surfaces for which lanes are blocked, ready, or complete and which handoffs are still pending.

Taken together, these planning queries are the current alpha-complete planning boundary:

- `next-action`: minimal pointer
- `single-agent-plan`: explicit default operating loop
- `multi-agent-plan`: optional import-adopt decomposition
- `work-packet`: bounded worker assignment for external agent systems
- `lane-status` and `handoff-status`: current artifact-backed coordination state

They do not yet claim a scheduler, hosted orchestration runtime, or authoritative freeform agent messaging layer.

Topogram remains structure-first. These outputs help agents load the smallest correct slice of intent, while tokenizer-specific optimization remains future work.

## Verification Modes

- `npm run generate:compile-check-bundle`: proves the generated server and web bundles can install and pass type/build checks
- `npm run generate:runtime-smoke-bundle`: gives a fast minimal confidence check that the generated stack is up, the UI responds, and the basic task flow works
- `npm run generate:runtime-check-bundle`: gives richer staged verification for readiness, core API flows, export/job flows, lookup endpoints, and important negative cases

Use `compile-check` when you want build confidence, `smoke` when you want a quick runtime sanity check, and `runtime-check` when you want the highest-signal generated verification pass.

## Auth Profile

`bearer_jwt_hs256` is the primary generated auth profile for Topogram's current alpha auth proof surface.

Set:

- `TOPOGRAM_AUTH_PROFILE=bearer_jwt_hs256`
- `TOPOGRAM_AUTH_JWT_SECRET`
- `TOPOGRAM_AUTH_TOKEN`
- `PUBLIC_TOPOGRAM_AUTH_TOKEN`

Examples may also provide proof-specific tokens such as:

- `TOPOGRAM_AUTH_TOKEN_EXPIRED`
- `TOPOGRAM_AUTH_TOKEN_INVALID`
- `TOPOGRAM_AUTH_TOKEN_NO_REVIEWER`

The current example proof matrix is:

- `permission`: [../examples/issues](../examples/issues)
- `ownership`: [../examples/issues](../examples/issues)
- `claim`: [../examples/content-approval](../examples/content-approval)

Generated web clients attach `PUBLIC_TOPOGRAM_AUTH_TOKEN` automatically on secured requests, and generated smoke/runtime-check bundles use `TOPOGRAM_AUTH_TOKEN` when present.

The current auth proof boundary includes:

- signed bearer token verification
- `401` missing, invalid-signature, and expired-token behavior
- `403` forbidden behavior for authenticated principals that fail modeled auth rules
- generated permission, ownership, and claim enforcement
- generated UI visibility that follows the same modeled auth rules

For the primary auth profile and alpha boundary, see [../docs/auth-profile-bearer-jwt-hs256.md](../docs/auth-profile-bearer-jwt-hs256.md).

`bearer_demo` remains supported as a lighter local/demo profile. It is no longer the primary auth narrative. For that profile, see [../docs/auth-profile-bearer-demo.md](../docs/auth-profile-bearer-demo.md).

For the modeled authorization surface itself, including when to use `permission`, `ownership`, and `claim`, see [../docs/auth-modeling.md](../docs/auth-modeling.md).

For brownfield repos, `reconcile` can now infer review-required auth hints from imported auth evidence and surface them in bundle READMEs, reconcile reports, and projection patch candidates. That currently includes:

- permission hints such as `permission issues.update`
- claim hints such as `claim reviewer = true`
- ownership hints such as `ownership owner_or_admin ownership_field assignee_id`

When imported role evidence lines up with those auth-sensitive capabilities, the same bundle review surfaces will also include auth-focused role guidance such as `role role_reviewer`, so the operator can confirm the likely participant side before promoting role or auth changes.

When a hint lines up with imported capability adoption, the adoption plan will include:

- `apply_projection_permission_patch` for inferred permission rules
- `apply_projection_auth_patch` for inferred claim rules
- `apply_projection_ownership_patch` for inferred ownership rules

Those items stay blocked on the normal `projection-review:<id>` flow until explicitly approved.

The intended brownfield auth loop is:

1. run `reconcile`
2. review the inferred auth hints and projection patch candidates
3. approve the affected `projection-review:<id>` group
4. run `reconcile --adopt from-plan --write`

That final `from-plan` step can now both promote the imported capability and patch the canonical projection with inferred `http_authz` permission, claim, and ownership rules, and with inferred `ui_visibility` permission or claim rules where available. This remains review-driven and is not auto-applied during plain reconcile runs.

When the auth review surface gets crowded, `query auth-hints <path>` gives a compact artifact-backed landscape summary of unresolved, deferred, and adopted auth hints, stale high-risk bundles, auth-relevant role follow-up, and the exact next review/adopt steps.

When one auth-sensitive bundle needs closer review, `query auth-review-packet <path> --bundle <slug>` gives a bundle-scoped handoff packet with unresolved/deferred hints, auth role follow-up, closure and aging state, projection patch actions, and the exact review steps to take before `from-plan`.
