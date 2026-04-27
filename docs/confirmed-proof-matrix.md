# Confirmed Imported Proof Matrix

This page is the product-repo index for imported brownfield proof claims.

The actual imported proof targets belong in the separate [topogram-demo](https://github.com/attebury/topogram-demo) repo. The product repo keeps only the claim contract, the active claim set, and the operating rules for staying honest about proof freshness.

Use these alongside:

- [examples/imported/README.md](../examples/imported/README.md)
- [topogram-demo-ops.md](./topogram-demo-ops.md)
- [agent-planning-evaluator-path.md](./agent-planning-evaluator-path.md)
- [topogram-demo/examples/imported](https://github.com/attebury/topogram-demo/tree/main/examples/imported)
- [topogram-demo/examples/native](https://github.com/attebury/topogram-demo/tree/main/examples/native) — full-stack native parity (separate from imported brownfield)

This page is not the local brownfield rehearsal guide.

For the canonical local evaluator path inside `topogram`, use:

- `bash ./scripts/run-brownfield-rehearsal.sh`
- `bash ./scripts/verify-brownfield-rehearsal.sh`
- `bash ./scripts/verify-agent-planning.sh`
- [agent-planning-evaluator-path.md](./agent-planning-evaluator-path.md)

## Active Imported Claims

These are the imported proof targets that should stay evaluator-visible:

- `supabase-express-api`
- `eShopOnWeb`
- `clean-architecture-swiftui`
- `rails-realworld-example-app`
- `django-realworld-example-app`

Everything else should be treated as either archived, experimental, or migration-era corpus material until it is explicitly promoted.

## Native parity vs imported (both in topogram-demo)

Both live in **[topogram-demo](https://github.com/attebury/topogram-demo)** but prove different things:

| Claim type | Typical folder | What it proves |
|------------|----------------|----------------|
| **Imported brownfield** | [`examples/imported/<target>/`](https://github.com/attebury/topogram-demo/tree/main/examples/imported) | Real external app snapshot, reconcile/adopt path, `adoption-status.json`, imported freshness |
| **Native full parity** | [`examples/native/<target>/`](https://github.com/attebury/topogram-demo/tree/main/examples/native) | Pinned Xcode/Gradle (or equivalent) **build** of generated or placed native workspaces vs documented Topogram commit; ops scripts `verify-native-targets` / `native-claim-freshness` |

Neither replaces **thin** generator proofs in the **topogram** product repo. See [topogram-demo-ops.md](./topogram-demo-ops.md).

## Brownfield Proof Split

Keep this proof split explicit:

- `topogram` proves the deterministic staged import/adopt rehearsal, the review-aware operator loop, the planning surfaces, and the conservative `stop_no_go` boundary on the canonical local fixture
- `topogram-demo` proves active imported breadth on real external systems, freshness-current imported claims, and rerunnable imported proof evidence

Do not treat the local staged rehearsal fixture as the same thing as the active imported proof set.

## Imported Proof Contract

Every active imported proof target must publish:

- real imported brownfield evidence
- adopted canonical Topogram outputs
- saved `adoption-status.json`
- explicit proof status metadata
- the Topogram commit used for the run
- exact rerun commands

For a proof to count as `closed`, it must satisfy:

- `next_bundle === null`
- `blocked_item_count === 0`
- `applied_item_count > 0`

## Ops Rule

Do not leave imported proofs in an ambiguous state.

Each active imported target should be marked as one of:

- `closed`
- `partial`
- `drifting`
- `broken`
- `archived`

If a proof stops passing, update the status instead of letting the public claim silently drift.
