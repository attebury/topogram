# Brownfield Trial: tRPC Next Prisma Starter

## Trial Target

Repository:

- `trials/trpc-examples-next-prisma-starter`

Why this trial matters:

- real app, not a curated example
- Prisma schema source
- Next.js Pages Router UI
- tRPC API layer instead of REST/OpenAPI

## Current Baseline Result

The current brownfield pass is written under:

- `trials/trpc-examples-next-prisma-starter/topogram/candidates/`

What now imports:

- DB: 1 entity
- API: 3 capabilities
- UI: 2 screens
- workflows: 1 workflow

Reconcile now produces one meaningful candidate bundle:

- `post`

with candidate files for:

- `entity_post`
- `cap_list_posts`
- `cap_get_post`
- `cap_create_post`
- `workflow_post`
- UI reports for `post_list` and `post_detail`

## What Worked

- Prisma DB import
- tRPC router procedure import for:
  - `post.list`
  - `post.byId`
  - `post.add`
- Next.js Pages Router UI import for:
  - `/`
  - `/post/[id]`
- workflow inference for `post`
- docs scan
- gap reporting
- reconcile/adoption queue generation

## What Was Confirmed Missing

- richer tRPC input/output shape extraction
- stronger Pages Router concept typing beyond the `post` case
- broader workflow inference from typed procedures and query/mutation semantics
- canonical adoption proof for this repo

## Why This Trial Is Useful

This repo now imports enough to prove the extractor-registry architecture can absorb:

- `api/trpc`
- `ui/next-pages-router`

The next improvement pass should deepen those two extractors rather than invent a new workflow layer.

## Success Criteria

A useful first pass does not require full adoption.

It should be enough to show:

- what the current system can already recover
- where the missing extractor coverage begins
- whether the extractor-registry architecture cleanly supports those additions
