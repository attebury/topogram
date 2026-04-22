# Brownfield Trial: Prisma GraphQL SDL First

Repo:

- [`prisma-examples/orm/graphql-sdl-first`](https://github.com/prisma/prisma-examples/tree/latest/orm/graphql-sdl-first)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first)

## Goal

Pressure the extractor-registry architecture against a schema-first GraphQL backend instead of another REST stack.

This trial is intended to validate:

- Prisma DB import
- GraphQL SDL API import
- workflow inference from GraphQL queries and mutations
- reconcile/adoption on a backend-only GraphQL app

## What Was Added

The trial exposed a clear gap at baseline: DB import worked, but API, UI, and workflow import were effectively zero.

To close that, Topogram gained a first GraphQL SDL extractor:

- [engine/src/import/extractors/api/graphql-sdl.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/api/graphql-sdl.js)

That extractor now:

- detects explicit GraphQL SDL from `typeDefs`/`gql` sources
- parses `Query` and `Mutation` root operations
- flattens input object fields into capability input hints
- derives output field hints from returned object types
- infers candidate capability ids and target states
- feeds the existing workflow inference layer

## Trial Result

Current import summary:

- DB: 2 entities
- API: 8 capabilities, 2 routes, stack `graphql_sdl`
- UI: backend-only / none
- workflows: 2 workflows, 4 transitions

Key imported capabilities:

- `cap_list_posts`
- `cap_get_post`
- `cap_create_post`
- `cap_publish_post`
- `cap_delete_post`
- `cap_update_post_view_count`
- `cap_list_users`
- `cap_register_user`

Key canonical adopted concepts:

- `post`
- `user`

Canonical outputs now live under:

- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/entities](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/capabilities](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/shapes](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/decisions](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/docs/workflows)

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/candidates/app/report.md)
- [Gap report](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/candidates/reports/gap-report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first/topogram/candidates/reconcile/adoption-status.md)

## Notes

- This is a meaningful proof that the extractor architecture generalizes beyond REST-centric stacks.
- The GraphQL trial is backend-only, so it does not yet pressure UI extraction.
- The current GraphQL extractor is intentionally SDL-first. Resolver-level depth, GraphQL schema file import, and richer nested output modeling can still improve from here.
