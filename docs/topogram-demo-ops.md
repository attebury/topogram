# Topogram Demo Ops

This page defines how imported brownfield proof targets are managed outside the main product repo.

The canonical imported-proof home is [topogram-demo](https://github.com/attebury/topogram-demo).

For the initial GitHub bootstrap and first-target migration order, see [Topogram Demo Bootstrap](./topogram-demo-bootstrap.md).

## Repo Split

- `topogram`: product code, generated examples, maintained examples, curated fixtures, evaluator docs
- `topogram-demo`: imported proof targets and brownfield credibility claims

The goal is to keep the product repo small and product-shaped while making imported proof claims easier to inspect.

## Imported Proof Taxonomy

The shared taxonomy is:

- `examples/generated/<app>`
- `examples/maintained/<app>`
- `examples/imported/<app>`

In practice:

- `topogram` owns `generated` and `maintained`
- `topogram-demo` owns `imported`

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
