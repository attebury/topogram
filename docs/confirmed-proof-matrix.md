# Confirmed Imported Proof Matrix

This page is now the product-repo index for imported brownfield proof claims.

The actual imported proof targets belong in the separate [topogram-demo](https://github.com/attebury/topogram-demo) repo. The product repo keeps only the claim contract, the active claim set, and the operating rules for staying honest about proof freshness.

Use these alongside:

- [examples/imported/README.md](../examples/imported/README.md)
- [topogram-demo-ops.md](./topogram-demo-ops.md)
- [topogram-demo/examples/imported](https://github.com/attebury/topogram-demo/tree/main/examples/imported)

## Active Imported Claims

These are the imported proof targets that should stay evaluator-visible:

- `supabase-express-api`
- `eShopOnWeb`
- `clean-architecture-swiftui`
- `rails-realworld-example-app`
- `django-realworld-example-app`

Everything else should be treated as either archived, experimental, or migration-era corpus material until it is explicitly promoted.

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
