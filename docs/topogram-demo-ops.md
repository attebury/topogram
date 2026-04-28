# Topogram Demo Ops

This page defines how **imported brownfield** proof targets and the **`examples/native/`** parity tier are managed outside the main product repo.

Status: deferred during the generated-app reset. `topogram-demo` remains reference material for imported/brownfield proof history, but it is not part of the active quickstart, CI path, or engine development workflow.

The canonical imported-proof home is [topogram-demo](https://github.com/attebury/topogram-demo).

For the initial GitHub bootstrap and first-target migration order, see [Topogram Demo Bootstrap](./project-management/archive/topogram-demo-bootstrap.md).

## Repo Split

- `topogram`: product code, generated examples, maintained examples, curated fixtures, evaluator docs
- `topogram-demo`: imported proof targets, **`examples/native/`** full-stack parity proofs, and brownfield credibility claims

The goal is to keep the product repo small and product-shaped while making imported proof claims easier to inspect.

## Native / full-stack parity tier (`examples/native/`)

[`topogram-demo/examples/native`](https://github.com/attebury/topogram-demo/tree/main/examples/native) holds **full native parity** proofs: Xcode / Gradle (or equivalent) builds with **pinned toolchains**, rerun scripts, and `proof-status.json` metadata—without requiring the **topogram** product repo to run macOS CI on every PR.

This tier is **orthogonal** to [`examples/imported`](https://github.com/attebury/topogram-demo/tree/main/examples/imported):

| Folder | Proves |
|--------|--------|
| `examples/imported/<target>/` | Brownfield **import**, reconcile, adopt into canonical Topogram |
| `examples/native/<target>/` | **Generated or hand-placed** native workspaces that prove “builds on pinned iOS/Android SDK” against a documented Topogram commit |

**Engine targets:** In `topogram`, the **`native-parity-plan`** and **`native-parity-bundle`** generator targets emit minimal pinned-toolchain Android (Gradle/Kotlin) and iOS (Swift Package / SwiftUI) scaffolding wired to workspace runtime URLs. After verification, copy or adapt that output into **`topogram-demo`** under `examples/native/<slug>/` as the promoted parity proof.

**Verification boundary:** native parity checks run in **topogram-demo** (`node ./ops/verify-native-targets.mjs`, optional `node ./ops/native-claim-freshness.mjs`). They are **not** part of default `verify-engine.sh` or everyday `npm test` in the product repo.

**Release handshake:** Before claiming **native/mobile parity** in public-facing alpha material (blog, landing copy), confirm `topogram-demo` native targets are freshness-current or explicitly marked `archived`, analogous to imported-proof freshness discipline — **separate checkbox** from imported-proof freshness.

## Imported Proof Taxonomy

The shared taxonomy is:

- `examples/generated/<app>`
- `examples/maintained/<app>`
- `examples/imported/<app>`

In practice:

- `topogram` owns `generated` and `maintained`
- `topogram-demo` owns `imported` and `examples/native`

## What Each Imported Proof Must Publish

Each imported proof target in [`topogram-demo/examples/imported`](https://github.com/attebury/topogram-demo/tree/main/examples/imported) should include:

- the source snapshot
- committed `topogram/`
- a short README
- exact rerun commands
- proof status metadata

Required proof status fields:

- `Topogram commit tested`
- `proof status`
- `last verified date`
- `known blockers`

Recommended proof statuses:

- `closed`
- `partial`
- `drifting`
- `broken`
- `archived`

## Active Claim Rules

Only 3-5 imported proof targets should be treated as current active claims.

Promote a target to active only when:

- rerun commands still work
- the proof contract still passes
- docs match the real outcome

Archive or mark drifting proof targets instead of leaving stale claims in the active set.

## Verification Boundary

Product-repo verification should use:

- `npm test` in `/engine` for fast curated engine checks
- generated example verification entrypoints
- maintained proof verification entrypoints

Imported proof verification should run in `topogram-demo` or a dedicated proof-ops job, not as part of normal product-repo validation.

The old broad imported corpus check remains available as an opt-in legacy command in the product repo:

```bash
cd ./engine
npm run test:proof-corpus
```

Treat that as migration-era proof ops, not as the default CI lane for the product repo.

The old local `trials/` tree has now been fully replaced in the product repo.

Use:

- [remaining-trial-policy.md](./remaining-trial-policy.md) for the completed migration record
- [import-fixtures-inventory.md](./import-fixtures-inventory.md) for the current curated fixture catalog that still feeds the optional proof-corpus lane

## Release Handshake

`topogram` release and merge confidence now depends on `topogram-demo` claim freshness, not on a local imported corpus.

For alpha, this is a launch requirement, not beta hardening.

Use this operating rule:

- after merging a `topogram` change that could affect imported claims, run or inspect the `topogram-demo` imported proof freshness workflow
- before treating a `topogram` `main` commit as alpha-facing release-ready or demo-ready, confirm the active imported claims in `topogram-demo` are still freshness-current against that exact `topogram` commit
- if `topogram-demo` reports stale imported claims, treat that as release-ops work, not as a reason to rebuild local proof mirrors in the product repo

Practical sequence:

1. Merge the `topogram` change.
2. Let `topogram-demo` compare its active imported claims against the new `topogram` `main`.
3. If freshness drift appears, rerun and refresh the affected imported targets in `topogram-demo`.
4. Only use imported-proof claims in alpha release or evaluator material after that refresh path is green again.

If the merge touched **engine native generators** or native golden fixtures (when they exist), optionally run **`node ./ops/native-claim-freshness.mjs`** in `topogram-demo` against [`examples/native`](https://github.com/attebury/topogram-demo/tree/main/examples/native) targets that are not `archived`.

The green bar for that refresh path is:

- `node ./ops/verify-imported-targets.mjs` passes in `topogram-demo`
- `node ./ops/claim-freshness.mjs --topogram-repo ../topogram` passes in `topogram-demo`
- the non-PR full-set freshness run no longer has an open `Imported proof freshness drift` issue

That loop has now been rehearsed end to end on the active imported set, so this is an operational alpha requirement rather than a hypothetical future contract.
