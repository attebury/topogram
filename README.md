# Topogram

Topogram helps humans and agents evolve software safely.

It keeps intent, generated outputs, and verification aligned so software changes stay structured, explainable, and provable instead of drifting across prompts, code, and docs.

Topogram is a spec-and-proof layer for controlled software evolution. It models the parts that should stay durable, generates contracts and runnable artifacts from that model, and keeps verification attached to the same source of truth.

```mermaid
flowchart LR
  A["Durable intent<br/>entities, workflows, rules"] --> B["Generated outputs<br/>contracts, runtimes, artifacts"]
  B --> C["Verification<br/>compile, smoke, runtime-check"]
  C --> D["Safer change in real software<br/>structured, explainable, provable"]
  D --> E["Controlled software evolution<br/>for humans and agents"]
```

## Why Topogram

Teams are starting to use agents to change real software. The hard part is no longer “can the model write code?” The hard part is whether the change keeps architecture, workflow semantics, and verification aligned.

Topogram gives humans and agents a system to work within:

- explicit domain and workflow models
- projections for API, UI, and persistence
- generated contracts, schemas, scaffolds, and runnable artifacts
- verification that stays attached to the modeled intent
- a clear boundary between modeled surfaces and hand-maintained code

The goal is not to replace engineering judgment. The goal is to give judgment a durable home, so agents can help evolve software without turning the system into prompt-shaped drift.

## Why Now

Agent use is increasing, but prompt-driven software work tends to scatter intent across chats, generated diffs, and partial runtime checks.

Topogram exists for teams that want:

- a durable source of product and workflow intent
- explicit boundaries around what should be generated vs hand-maintained
- emitted contracts that humans can audit
- proof that generated and maintained surfaces still line up after change

## What It Is

Topogram is not just a schema tool and not just an app generator.

It is a way to capture durable software intent so humans and agents can:

- model domain concepts, workflows, rules, and decisions
- generate contracts, runtime bundles, and reference apps from shared structure
- verify modeled behavior through compile, smoke, and runtime checks
- recover structure from existing systems through brownfield import and reconciliation
- evolve hand-maintained apps with a clearer model-driven change boundary

## Human And Agent Workflow

Topogram works best when the collaboration layers stay clear:

- humans own durable intent such as entities, capabilities, rules, workflows, journeys, and adoption decisions
- agents work from scoped context, candidate imports, draft docs, reconcile reports, and adoption plans
- the engine owns canonical realization and proof outputs such as contracts, apps, verification, diffs, digests, and bundles

The default operating model is:

1. humans define or approve durable meaning
2. agents propose changes or gather scoped context
3. the engine realizes contracts, generated artifacts, and proof
4. humans review and adopt semantic changes deliberately

The current planning boundary is now explicit too:

- `query next-action` is the minimal pointer
- `query single-agent-plan` is the default operating loop for one agent or operator
- `query multi-agent-plan --mode import-adopt` is the optional decomposition for more complex brownfield work
- `query work-packet --mode import-adopt --lane <id>` is the bounded assignment surface for one worker
- `review-packet` and `proceed-decision` now carry the compact operator loop, recommended query family, and first artifacts to inspect

That planning stack is artifact-backed and alpha-complete for guidance. It is not yet a built-in scheduler or hosted orchestration runtime.

```mermaid
flowchart LR
  subgraph H["Humans"]
    H1["Own durable intent"]
    H2["Approve adoption decisions"]
    H3["Keep final product judgment"]
  end
  subgraph A["Agents"]
    A1["Gather scoped context"]
    A2["Propose changes"]
    A3["Prepare review material"]
  end
  subgraph E["Engine"]
    E1["Realize contracts"]
    E2["Generate artifacts and apps"]
    E3["Attach verification and proof"]
  end
  H --> A
  A --> E
  E --> H
```

For the fuller collaboration and workspace-boundary guidance, see [docs/human-agent-collaboration.md](./docs/human-agent-collaboration.md) and [docs/topogram-workspace-layout.md](./docs/topogram-workspace-layout.md).

## Current Proof Points

This repo is grounded in working proofs, not just concept demos:

- [examples/generated/todo](./examples/generated/todo): the smallest end-to-end reference example
- [examples/generated/issues](./examples/generated/issues): a multi-frontend issue-tracker proof
- [examples/generated/content-approval](./examples/generated/content-approval): a workflow-heavy proof that pressures non-Todo abstractions
- [examples/maintained/proof-app](./examples/maintained/proof-app): a hand-maintained proof app showing how Topogram can guide edits to existing code, including cross-surface alignment across detail, list, and route affordances
- [examples/imported](./examples/imported): the imported-proof bridge and brownfield claim index for the separate [topogram-demo](https://github.com/attebury/topogram-demo) proof repo
- [docs/topogram-demo-ops.md](./docs/topogram-demo-ops.md): the ops contract for keeping imported proof claims fresh in [topogram-demo](https://github.com/attebury/topogram-demo)
- [docs/testing-strategy.md](./docs/testing-strategy.md): the verification philosophy and current regression layers
- [docs/proof-points-and-limits.md](./docs/proof-points-and-limits.md): the current claim boundary, proof matrix, and known limits
- [docs/alpha-overview.md](./docs/alpha-overview.md): the short visual walkthrough for evaluators and design partners
- [docs/skeptical-evaluator.md](./docs/skeptical-evaluator.md): direct answers to the strongest skeptical objections
- [docs/evaluator-path.md](./docs/evaluator-path.md): the canonical evaluator flow and demo path
- [docs/agent-planning-evaluator-path.md](./docs/agent-planning-evaluator-path.md): the shortest evaluator-facing proof path for single-agent and multi-agent planning

## Good Fit

Topogram is a strong fit for:

- technical teams comfortable with early infrastructure
- builders already working with coding agents
- teams that care about domain and workflow modeling
- brownfield modernization efforts
- teams that want controlled app evolution instead of prompt-driven drift

## Who This Is For Right Now

Topogram is for technical teams already using coding agents who need stronger structure, review boundaries, and proof while evolving real software.

For the design-partner profile and current invite path, see [docs/design-partner-profile.md](./docs/design-partner-profile.md) and [docs/invite-led-alpha.md](./docs/invite-led-alpha.md).

## Current Limits

Topogram is still an early system. It should not be presented as:

- a generic no-code tool
- a production-ready auth platform
- a magic prompt-to-product box
- a replacement for engineering judgment

Current auth support should be treated as alpha-complete and proof-oriented, not production-ready. Start with [docs/auth-evaluator-path.md](./docs/auth-evaluator-path.md) and [docs/auth-profile-bearer-jwt-hs256.md](./docs/auth-profile-bearer-jwt-hs256.md) for the current boundary.

Topogram generality is also still under active proof. The product repo now keeps generated and maintained examples locally, while imported brownfield proof targets are managed as a separate proof-ops concern so this repo does not double as a trial corpus.

The remaining local `trials/` directories are migration-era product fixtures or temporary local mirrors, not the public source of truth for imported proof claims. See [docs/remaining-trial-policy.md](./docs/remaining-trial-policy.md).

## FAQ

### Can an agent generate an app from a correct Topogram without the engine?

In principle, yes. A well-formed Topogram should be rich enough for an agent to reason about app generation and software change.

Topogram's engine still matters because it is the canonical realization and verification path:

- the Topogram is the durable source of truth
- the engine makes realization deterministic, reusable, and inspectable
- agents remain flexible consumers of that same intent

### Is Topogram designed to minimize tokens?

Topogram is structure-first, not a prompt-compression system first.

The new `context-*` engine targets make that structure easier for agents to consume in smaller slices:

- `context-diff` serves semantic deltas instead of forcing a full workspace reload
- `context-slice` serves one capability, workflow, projection, entity, or journey plus its dependency closure
- `context-digest` emits compact machine digests for workspace and per-surface semantics
- `context-bundle` emits task-shaped views such as `api`, `ui`, `db`, and `maintained-app`
- `context-report` measures the resulting byte and line-count reductions against the resolved graph
- `context-task-mode` tells an agent which context, write scope, review focus, and proof targets fit a given mode of work

These targets are meant to reduce rediscovery and ambiguity. Model-specific token optimization remains future work.

The current agent-facing contract also includes:

- explicit review classes: `safe`, `review_required`, `manual_decision`, `no_go`
- machine-readable maintained-app boundaries for human-owned code seams
- seam-family-aware maintained drift and conformance summaries so one semantic drift can be shown across multiple maintained surfaces
- a stage-based adoption-plan view where proposals can be `accept`, `map`, `customize`, `stage`, or `reject`
- conservative brownfield seam-review summaries that distinguish clear candidates from no-candidate proposals

## Getting Started

The fastest way to get oriented is to validate the core examples and generate one runnable bundle.

```bash
cd ./engine
npm run validate
npm run validate:issues
npm run validate:content-approval
npm run generate:app-bundle
npm run generate:context-digest
```

## Verification

The repo has stable top-level verification entrypoints so local runs and CI use the same commands:

```bash
bash ./scripts/verify-engine.sh
bash ./scripts/verify-product-app.sh
bash ./scripts/verify-generated-example.sh todo compile-smoke
bash ./scripts/verify-issues-parity.sh
bash ./scripts/verify-parity-matrix.sh
bash ./scripts/verify-agent-planning.sh
bash ./scripts/verify-brownfield-rehearsal.sh
bash ./scripts/audit-issues-contract-diff.sh
```

Use them like this:

- `verify-engine.sh`: fast curated engine regression, including narrow engine tests plus generated-example validation
- `verify-product-app.sh`: required maintained-proof gate for `examples/maintained/proof-app`
- `verify-generated-example.sh <example> compile-smoke`: compile plus smoke verification for one generated example
- `verify-generated-example.sh <example> full`: compile, runtime-check, and smoke verification for one generated example
- `verify-issues-parity.sh`: the shortest evaluator-facing proof for `issues` web and backend parity
- `verify-parity-matrix.sh`: the shortest evaluator-facing proof for the current cross-domain parity matrix
- `verify-agent-planning.sh`: the shortest evaluator-facing proof for the current single-agent and multi-agent planning stack
- `verify-brownfield-rehearsal.sh`: the shortest evaluator-facing proof for the canonical import-plan -> review-packet -> proceed-decision brownfield loop
- `audit-issues-contract-diff.sh`: the shortest emitted-contract audit for the current `issues` parity seams

For the quickest live brownfield walkthrough, run:

```bash
bash ./scripts/run-brownfield-rehearsal.sh
```

## Local Guardrail

This repo now includes a repo-local `pre-push` hook that blocks newly introduced machine-specific absolute filesystem paths in changed human-facing and source files.

To enable it locally:

```bash
git config core.hooksPath .githooks
```

The hook intentionally skips known generated example outputs and expected fixtures under `examples/**` for now. The broader normalization of those committed generated paths remains separate cleanup work.

## License

Topogram is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
Copyright is documented in [NOTICE](./NOTICE).

## Repo Layout

This repo is organized around three example relationships to Topogram:

- `examples/generated/<app>`: Topogram-owned generated reference apps
- `examples/maintained/<app>`: Topogram-owned maintained proof apps
- `examples/imported/<app>`: imported proof targets that belong in the separate [topogram-demo](https://github.com/attebury/topogram-demo) proof repo

Within this product repo, imported examples are represented only by bridge docs and ops contracts so the product surface stays smaller and clearer.

- [engine](./engine): the actual Topogram implementation
- [examples/generated/todo](./examples/generated/todo): the Todo Topogram package, generated artifacts, apps, and fixtures
- [examples/generated/issues](./examples/generated/issues): the issue-tracker proof example
- [examples/generated/content-approval](./examples/generated/content-approval): the workflow-heavy proof example
- [examples/maintained/proof-app](./examples/maintained/proof-app): the maintained proof app
- [examples/imported](./examples/imported): imported brownfield proof index and demo-repo bridge
- [docs](./docs): planning notes, proof summaries, and architecture/reference docs

Within each Topogram workspace, the intended split is:

- canonical `topogram/**` surfaces for durable human-owned meaning
- `candidates/**` for imported, inferred, or draft surfaces awaiting review
- `artifacts/**` and `apps/**` for generated engine-owned outputs

## Working Model

The intended workflow in this repo is:

1. Update the Topogram engine in [engine](./engine) when the platform itself changes.
2. Update one of the example Topogram packages under [examples](./examples) when a domain changes.
3. Regenerate example artifacts and runtimes under each example's `artifacts/` and `apps/` folders.
4. Use those outputs as contracts, references, and runnable proofs.
5. Build or evolve hand-maintained code in [examples/maintained/proof-app](./examples/maintained/proof-app).
