# Topogram Demo Bootstrap

This page defines the first concrete shape of the separate `topogram-demo` repo.

Use it when you are ready to make the product/demo split real on GitHub.

## Goal

Create a second repo that makes imported proof claims easy to inspect without forcing the main `topogram` repo to keep a large live brownfield corpus.

The split should become:

- `topogram`: product code, generated examples, maintained examples, curated fixtures, product-facing docs
- `topogram-demo`: imported proof targets, proof status, rerun commands, brownfield credibility claims

## First Repo Shape

The initial `topogram-demo` tree should be:

```text
topogram-demo/
  README.md
  examples/
    imported/
      README.md
      supabase-express-api/
        README.md
        proof-status.json
        source/
        topogram/
      eshoponweb/
        README.md
        proof-status.json
        source/
        topogram/
      clean-architecture-swiftui/
        README.md
        proof-status.json
        source/
        topogram/
  ops/
    active-claims.md
    proof-statuses.md
```

Recommended later additions:

- `examples/imported/rails-realworld-example-app/`
- `examples/imported/django-realworld-example-app/`
- `examples/imported/archive/` for no-longer-active targets

## Initial Imported Targets

Start with a small active claim set.

Recommended first three:

1. `supabase-express-api`
2. `eshoponweb`
3. `clean-architecture-swiftui`

These give a strong first proof spread:

- JS/backend-first maintained-boundary proof
- .NET brownfield proof
- mobile/non-web proof

Add `rails-realworld-example-app` and `django-realworld-example-app` only after the repo shape and proof-status workflow feel stable.

## What Each Imported Target Must Contain

Each imported target should contain:

- `source/`
  - the imported app snapshot
- `topogram/`
  - committed Topogram outputs for that snapshot
- `README.md`
  - what this proves
  - exact rerun commands
  - what remains manual or unresolved
- `proof-status.json`
  - the current machine-readable proof status

Recommended `proof-status.json` shape:

```json
{
  "target": "supabase-express-api",
  "status": "closed",
  "topogram_commit_tested": "abcdef1",
  "last_verified_date": "2026-04-22",
  "known_blockers": [],
  "notes": "Closed proof contract after reconcile/adopt."
}
```

Allowed `status` values:

- `closed`
- `partial`
- `drifting`
- `broken`
- `archived`

## Active Claim Rules

Keep the active imported claim set intentionally small:

- 3 active proof targets is ideal
- 5 is the upper bound

Only keep a target active when:

- rerun commands still work
- the documented proof contract still passes
- the README matches the actual current result

If a target drifts:

- mark it `drifting` or `broken`
- do not quietly leave it as an implied current claim

## README Shape For `topogram-demo`

The repo README should explain the split in one screen:

```md
# Topogram Demo

This repo contains imported proof targets for Topogram.

Use the main [topogram](https://github.com/attebury/topogram) repo for:
- product code
- generated examples
- maintained proof apps
- engine verification

Use this repo for:
- imported brownfield proof targets
- committed `topogram/` outputs for real external apps
- proof status and rerun commands

## Active Imported Claims

- `supabase-express-api`
- `eshoponweb`
- `clean-architecture-swiftui`

Each target publishes:
- source snapshot
- committed `topogram/`
- proof status
- exact rerun commands
```

## Proof Target README Shape

Each imported target README should use a common structure:

```md
# supabase-express-api

## What This Proves

Short statement of the active claim.

## Current Status

- proof status: `closed`
- Topogram commit tested: `abcdef1`
- last verified date: `2026-04-22`

## Rerun

Exact commands to rerun import, reconcile, and adoption.

## Current Limits

Known manual boundaries or unresolved items.
```

## How To Move Targets Out Of `topogram`

For each imported target:

1. copy the chosen trial source into `topogram-demo/examples/imported/<target>/source`
2. copy the committed `topogram/` directory into `topogram-demo/examples/imported/<target>/topogram`
3. add `README.md`
4. add `proof-status.json`
5. verify rerun commands from the current `topogram` engine still work
6. update bridge links in the main repo
7. remove the in-repo live proof dependency from `topogram` once the external proof target is stable

Do this one target at a time. Do not try to externalize the whole brownfield corpus in one move.

## Product Repo Bridge Updates

After `topogram-demo` exists, update these product-repo surfaces:

- `README.md`
- `examples/imported/README.md`
- `docs/confirmed-proof-matrix.md`
- `docs/evaluator-path.md`
- `docs/skeptical-evaluator.md`

Replace placeholder/bridge language with real GitHub links to the demo repo and its proof targets.

## Proof Ops Cadence

Use a lightweight ops rhythm:

- on each proof-affecting Topogram change:
  - rerun the active imported set
  - update `proof-status.json`
  - update `topogram_commit_tested`
- on a slower cadence:
  - rerun archived/reference proofs only when needed

Recommended issue labels in `topogram-demo`:

- `proof-active`
- `proof-drifting`
- `proof-broken`
- `proof-archived`

## Recommended Next Moves

1. Create `topogram-demo` on GitHub.
2. Seed it with the README and `examples/imported/README.md`.
3. Migrate `supabase-express-api` first.
4. Migrate `eshoponweb` second.
5. Migrate `clean-architecture-swiftui` third.
6. Update the main `topogram` repo to link directly to those targets.
