# Imported Example Bridge

This directory is the product-repo bridge for imported brownfield proof targets.

Topogram uses three example relationships:

- `examples/generated/<app>`: generated reference apps owned by this repo
- `examples/maintained/<app>`: maintained proof apps owned by this repo
- `examples/imported/<app>`: real existing systems imported into Topogram

Imported examples do not belong in the normal product-repo test path. Their long-lived home is the separate [topogram-demo](https://github.com/attebury/topogram-demo) repo, where each proof target should publish:

- the source snapshot
- committed `topogram/` outputs
- proof status metadata
- rerun commands
- known blockers or manual boundaries

## Active Imported Claim Set

The intended active imported claim set stays intentionally small:

- `supabase-express-api`
- `eShopOnWeb`
- `clean-architecture-swiftui`
- `rails-realworld-example-app`
- `django-realworld-example-app`

Use [docs/confirmed-proof-matrix.md](../../docs/confirmed-proof-matrix.md) for the current imported-proof contract, [docs/topogram-demo-ops.md](../../docs/topogram-demo-ops.md) for the operating model, and [topogram-demo/examples/imported](https://github.com/attebury/topogram-demo/tree/main/examples/imported) for the current imported proof targets.
