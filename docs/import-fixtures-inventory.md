# Import Fixtures Inventory

This page explains the curated fixtures under `engine/tests/fixtures/import` now that the product repo no longer keeps a checked-in `trials/` tree.

The short version:

- `topogram-demo` is the public home for imported proof claims
- `engine/tests/fixtures/import` is the product repo home for importer and proof-corpus regression inputs
- `engine/scripts/test.js` consumes these fixtures through a shared catalog in `engine/scripts/proof-corpus-fixtures.mjs`

## Why This Exists

The optional `npm run test:proof-corpus` lane still needs realistic importer inputs, but those inputs should be:

- curated
- small enough to keep in the product repo
- explicit about whether they are source-only, proof-only, or source-plus-proof fixtures

This inventory exists so operators do not have to read the full proof-corpus script just to understand which fixtures are in play.

## Fixture Kinds

- `contract-source`
  - fixtures used to pressure DB/API import behavior from compact contract-like inputs
- `source-only`
  - source trees used for importer coverage, where public imported proof lives elsewhere or confirmed-proof coverage is not needed locally
- `source-plus-proof`
  - fixtures that include both source material and a committed `topogram/` snapshot because the optional proof-corpus lane still checks confirmed-proof closure
- `proof-only`
  - extracted `topogram/` snapshots used only for confirmed-proof checks
- `adoption-planning`
  - partial workspaces used for import/adopt planning and review surfaces
- `narrow-test`
  - real-trial-derived fixtures used by focused narrow tests instead of the broad proof-corpus lane

## How To Inspect The Current Catalog

From [`engine`](../engine):

```bash
npm run test:proof-corpus:list
```

That command prints the shared catalog defined in `engine/scripts/proof-corpus-fixtures.mjs`, including:

- fixture slug
- fixture kind
- which verification surface uses it
- whether it also has a public imported-proof home in `topogram-demo`

## Current Governance Rules

- treat `topogram-demo/examples/imported/*` as the public proof source of truth
- treat `engine/tests/fixtures/import/*` as the product repo regression source of truth
- prefer `source-only` fixtures unless the local proof-corpus lane still needs confirmed-proof coverage
- prefer `proof-only` fixtures when importer source coverage is no longer needed
- do not reintroduce a top-level checked-in `trials/` directory just because a new fixture is needed

## When Adding A New Fixture

Before adding a fixture under `engine/tests/fixtures/import`:

1. decide whether the fixture is source-only, source-plus-proof, proof-only, or planning-only
2. add it to `engine/scripts/proof-corpus-fixtures.mjs`
3. use the shared catalog from scripts instead of hardcoding another fixture root in `engine/scripts/test.js`
4. normalize machine-specific absolute paths in copied metadata before committing
5. prefer the smallest practical fixture that still preserves the coverage you actually need

## Related Docs

- [Testing Strategy](./testing-strategy.md)
- [Remaining Trial Policy](./remaining-trial-policy.md)
- [Topogram Demo Ops](./topogram-demo-ops.md)
