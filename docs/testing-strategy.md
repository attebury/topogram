# Testing Strategy

This document describes how Topogram should think about testing and verification across the engine, example Topogram packages, generated artifacts, and generated runtimes.

It is intentionally specific to this repo's current structure and commands.

## Purpose

Topogram is not just a library and not just an app generator.

A meaningful change can affect:

- `.tg` syntax and semantics
- resolved model graphs
- generated contracts and docs
- generated server and web runtimes
- runtime verification bundles
- example-owned reference implementations

That means a generic testing pyramid is not enough on its own.

Topogram needs layered verification that answers five questions:

1. Is the model valid?
2. Does resolution preserve the intended semantics?
3. Did generation produce the right artifacts?
4. Does the generated software actually compile and run?
5. Do the modeled verification scenarios still match reality?

## Current Verification Layers

### 1. Model validation

Use parser, validator, and resolver checks to prove that valid workspaces still work and invalid workspaces still fail in the right ways.

Current examples:

- `engine/tests/fixtures/invalid`
- `npm run validate`
- `npm run validate:issues`
- `npm run validate:content-approval`

This layer is the first line of defense for:

- broken references
- invalid HTTP semantics
- invalid UI or DB projections
- bad expression and transform modeling
- docs and schema consistency errors

### 2. Semantic graph regression

Use resolved workspace outputs as a stable contract for meaning, not just syntax.

Current example:

- `examples/todo/topogram/tests/fixtures/expected/todo.resolve.json`

This layer is especially important when parser, validator, or resolver logic changes. A model can still parse while meaning something different.

### 3. Generated artifact regression

Use golden expected outputs for generated artifacts and bundles.

Current examples include expected fixtures under:

- `examples/todo/topogram/tests/fixtures/expected`
- `examples/issues/topogram/tests/fixtures/expected`
- `examples/content-approval/topogram/tests/fixtures/expected`

These fixtures currently cover outputs such as:

- JSON schema
- docs
- OpenAPI
- API contract graphs
- UI contracts
- DB schema snapshots
- migration plans
- verification plans and checklists
- generated runtime bundles

This is the main regression net for generator changes.

### 4. Verification-as-model

Topogram expresses important checks as canonical `verification` definitions inside the Topogram package.

Current examples:

- `examples/todo/topogram/verifications/verification-runtime-smoke.tg`
- `examples/todo/topogram/verifications/verification-task-runtime-flow.tg`
- `examples/todo/topogram/verifications/verification-create-task-policy.tg`

This is one of Topogram's strongest ideas.

Instead of keeping important verification logic only in shell scripts or test harness code, the repo models:

- what is being validated
- which capabilities or rules are covered
- which scenarios matter
- whether the verification is smoke-oriented or runtime-oriented

Those definitions then feed generated artifacts such as:

- verification plans
- verification checklists
- smoke bundles
- runtime-check bundles

### 5. Generated compile verification

Use generated compile-check bundles to prove that generated server and web bundles install and pass build or type checks.

Current command:

- `npm run generate:compile-check-bundle`

This layer is especially valuable because generator regressions often first show up as:

- broken imports
- invalid TypeScript
- missing runtime helpers
- invalid package wiring
- framework integration drift

### 6. Generated runtime verification

Use generated smoke and runtime-check bundles to verify that the stack is not only generated correctly, but is actually runnable.

Current commands:

- `npm run generate:runtime-smoke-bundle`
- `npm run generate:runtime-check-bundle`

These layers have different purposes:

- `smoke`: fast minimal confidence that the generated stack is up and basic flows work
- `runtime-check`: richer staged verification for readiness, core flows, negative cases, and machine-readable reporting

### 7. Database and migration verification

Use DB schema snapshots, migration plans, and lifecycle bundles to verify persistence behavior.

Current command families include:

- `generate:db-snapshot:*`
- `generate:migration:*`
- `generate:sql:*`
- `generate:db-lifecycle:*`

This layer matters because persistence bugs often look correct in generated source until they hit an actual database state transition.

### 8. Proof diversity across examples

Topogram should never rely on a single example as its only proof.

Current proof examples:

- `examples/todo`
- `examples/issues`
- `examples/content-approval`

These examples act as a compatibility and abstraction pressure matrix. They matter because a regression that does not break Todo may still break a different domain or target stack.

## Recommended Testing Pyramid

Topogram should treat the following as its practical testing pyramid:

### Base: fast semantic correctness

- parse
- validate
- resolve
- invalid fixture coverage

This layer should stay fast and deterministic.

### Middle: artifact correctness

- golden fixture comparison for generated outputs
- verification-plan and checklist generation
- migration-plan and schema snapshot generation

This layer catches most engine regressions with high signal.

### Upper middle: generated-system correctness

- compile-check bundles
- smoke bundles

This layer proves generated outputs are not only structurally correct, but operationally plausible.

### Top: high-confidence runtime correctness

- runtime-check bundles
- policy and negative-case verification
- richer API and lifecycle coverage

This layer is slower and should be used when changes touch runtime behavior or release confidence matters.

### Sidecar layer: targeted narrow tests

Topogram should also keep a small layer of focused tests where broad fixture tests are too coarse to diagnose failures quickly.

Best candidates:

- parser edge cases
- resolver invariants
- generator helper invariants
- brownfield import heuristics

These tests should exist to improve failure localization, not to replace the golden and end-to-end layers.

## What To Run For Each Kind Of Change

### Parser, validator, or resolver changes

Must run:

- `npm test`

Should update or add:

- valid fixtures
- invalid fixtures
- expected resolve outputs

Prefer:

- narrow targeted cases for the new rule or edge case

### Generator or realization changes

Must run:

- `npm test`

Should update or add:

- expected generated fixtures for affected artifacts

Prefer:

- `compile-check` for affected generated runtimes

### Runtime bundle generation changes

Must run:

- `npm test`

Prefer:

- `compile-check`
- `smoke`
- `runtime-check` when the change touches runtime behavior or API flow coverage

### Topogram example domain changes

Must run:

- validation for the affected example
- expected fixture updates for the affected example

Prefer:

- `smoke` for the affected example
- `runtime-check` if the change affects policy, lifecycle, or important user-facing flows

### Rule or policy changes

Must run:

- `npm test`

Should update:

- canonical `verification` definitions
- verification plans
- verification checklists

Prefer:

- runtime verification, because policy regressions often only become obvious during execution

### DB schema or migration changes

Must run:

- `npm test`

Should inspect:

- DB schema snapshots
- SQL schema output
- migration plans
- lifecycle bundles

Prefer:

- runtime verification when persistence changes affect visible flows

### Brownfield import or adoption changes

Must run:

- `npm test`

Should update or add:

- importer fixtures
- adoption fixtures
- expected imported or reconciled outputs

Prefer:

- small purpose-built fixtures over relying only on broad example proofs

### Preferred artifact order

Some Topogram work is naturally order-sensitive.

When a slice touches more than one layer, prefer building from structural artifacts upward instead of hardening downstream proof surfaces first.

Preferred order:

1. imported evidence
2. canonical model
3. projections and contracts
4. generated apps and runtime bundles
5. journeys, reports, and synthesized docs
6. maintained-app drift guards and proof scenarios

Why this order helps:

- structural model work such as entities, capabilities, shapes, UI, workflows, actors, and rules should settle before synthesis artifacts try to summarize them
- projections should follow stable capability and shape ids so API, DB, and UI outputs do not churn unnecessarily
- runtime bundles and maintained-proof checks are more trustworthy once emitted contracts are already the thing we mean to protect
- journeys are better treated as a synthesis layer over capabilities, screens, rules, and workflows than as a first-pass import artifact

For brownfield work, prefer this sequence:

1. `import app`
2. `import docs`
3. `report gaps`
4. `reconcile`
5. selective `reconcile adopt`
6. `generate journeys`
7. promote reviewed journey drafts into canonical `topogram/docs/journeys/*.md`

Short version:

- generate or adopt the structural core first
- generate journeys after the other candidate surfaces
- add runtime and maintained-proof hardening after emitted contracts and flows have stabilized

### Product app changes

Changes under `product/app` should get their own explicit verification path as the app becomes more central.

Right now, generated examples have the strongest verification story in the repo. The hand-maintained product app should not quietly become the least protected surface.

The maintained-app proof pattern should stay explicit and layered.

Use three small layers instead of putting all logic into one long script:

- emitted artifact helpers
  - read stable generated outputs such as OpenAPI, server-contract, UI-contract, DB snapshot, docs-index, or shape schema artifacts
  - avoid tying maintained-proof checks directly to raw `.tg` source text when an emitted artifact expresses the same meaning more cleanly
- proof scenarios
  - encode the maintained-app expectations for a specific proof story
  - keep emitted-artifact assertions separate from maintained presenter, route, form, or action assertions
- one composed runtime gate
  - keep `runtime-check` as the entrypoint that runs the relevant scenario assertions together

This separation matters because `product/app` is proving a different claim than generated examples.

Generated example verification answers:

- did Topogram generate a correct app?
- does the generated stack still build and run?

Maintained-app verification answers:

- did emitted Topogram artifacts change in a meaningful way?
- does the hand-maintained app still honor those emitted contracts and user-flow expectations?
- do unsafe or ambiguous changes still stop at a human-decision boundary instead of silently auto-updating?

When adding a new maintained proof under `product/app`, prefer this shape:

1. choose one emitted artifact seam
2. choose one maintained surface that mirrors it
3. add one proof scenario that fails if the emitted seam changes without a corresponding maintained update

Good maintained-proof seams include:

- emitted API or OpenAPI contract fields
- emitted DB relation semantics
- emitted UI contract surfaces
- emitted canonical journey expectations

Do not treat `product/app` as a second generated example.

It should remain hand-maintained code whose verification is driven by Topogram artifacts, not replaced by them.

## CI Recommendation

Topogram should use three verification tiers.

### Tier 1: every PR

Run:

- `bash scripts/verify-engine.sh`

Purpose:

- fast semantic feedback
- invalid fixture coverage
- golden artifact regression
- broad engine confidence

This should be the default gate for all engine and Topogram-package changes.

### Tier 2: high-confidence PR checks

Run for changes that affect generation or runtime bundles:

- `bash scripts/verify-generated-example.sh <example> compile-smoke`

Purpose:

- prove generated outputs still build
- prove the generated stack still basically works

This tier is the right PR gate for generator-heavy work.

### Tier 3: main or release confidence

Run:

- `bash scripts/verify-generated-example.sh todo full`
- `bash scripts/verify-generated-example.sh issues full`
- `bash scripts/verify-generated-example.sh content-approval full`
- `bash scripts/verify-product-app.sh`

Across:

- `todo`
- `issues`
- `content-approval`

Purpose:

- platform-level release confidence
- cross-example proof that abstractions still hold

If CI cost is tight, keep Tier 3 off the critical PR path and run it on merge to `main` or before release cuts.

## Suggested Path-Based CI Rules

These rules are intentionally simple and should be refined as CI evolves.

### If files change under `engine/src/parser*`, `engine/src/validator*`, or `engine/src/resolver*`

Run:

- Tier 1

### If files change under `engine/src/generator*` or `engine/src/realization*`

Run:

- Tier 1
- Tier 2

### If files change under `examples/*/topogram`

Run:

- Tier 1
- smoke for the affected example

Add runtime-check if the change affects:

- policies
- workflows
- lifecycle semantics
- runtime bundle generation

### If files change under runtime-check, smoke, compile-check, or generated app bundle code paths

Run:

- Tier 1
- Tier 2

### If preparing a release or merging a large engine refactor

Run:

- Tier 3

## Review Rules For Golden Fixtures

Golden fixtures are one of the most important verification assets in this repo, but they are also easy to misuse.

Working rules:

- never mass-refresh expected outputs without reviewing semantic diffs
- treat fixture updates as code changes, not bookkeeping
- prefer narrow expected files when a single broad fixture is too hard to review
- when a fixture changes unexpectedly, determine whether the change reflects an intended semantic shift or an accidental regression

The main risk of a golden-heavy testing strategy is not missing a diff. It is approving the wrong diff too casually.

## Current Gaps

The repo already has a strong verification story, but several gaps are still worth closing.

### 1. Failure localization

Broad fixture and bundle tests catch regressions well, but some failures are still too coarse.

Recommendation:

- add a small layer of narrow tests around high-risk pure logic

### 2. Independent verification

Generated verification is valuable, but some verification paths are generated by the same system they are testing.

Recommendation:

- keep at least a few checks that are independently simple and hard to break in the same way as the generator output

### 3. Product app coverage

`product/app` is less protected than generated examples.

Recommendation:

- add explicit compile and runtime expectations for that app as it becomes more important

### 4. Non-functional checks

The current focus is functional correctness. That is the right priority, but it leaves room for future work in:

- performance
- property-style invariants
- concurrency behavior
- security-specific verification
- compatibility matrix coverage

## Recommended Team Habits

- model important behavior as canonical `verification` definitions when possible
- keep smoke tests fast and minimal
- keep runtime checks scenario-rich and opinionated
- add invalid fixtures whenever a new class of forbidden state is introduced
- add narrow tests when a broad regression would be too hard to diagnose
- use example diversity as evidence of abstraction quality, not just demo quality

## Current Baseline

As of April 20, 2026, the current baseline command for broad engine confidence is:

```bash
cd ./engine
npm test
```

That is the repo's core regression entry point and should remain healthy, fast enough to run frequently, and review-trusted.

For CI and shared local usage, prefer the repo-level entrypoints:

```bash
bash ./scripts/verify-engine.sh
bash ./scripts/verify-product-app.sh
bash ./scripts/verify-generated-example.sh todo compile-smoke
```
