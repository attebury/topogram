# Brownfield Trial: Prisma GraphQL Nexus

Repo:

- [`prisma-examples/orm/graphql-nexus`](https://github.com/prisma/prisma-examples/tree/latest/orm/graphql-nexus)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus)

## Goal

Validate a true code-first GraphQL schema/resolver stack rather than another REST app.

This trial specifically tests whether Topogram can handle a GraphQL Nexus project where:

- schema and resolvers are authored in TypeScript
- the repo commits generated GraphQL SDL (`schema.graphql`)
- Prisma remains the DB source of truth

## Result

This trial worked without a new framework-specific parser because the repo already includes a generated schema file:

- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/schema.graphql](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/schema.graphql)

That means the current GraphQL SDL extractor can already serve a practical code-first GraphQL workflow when generated schema output is committed.

Import summary:

- DB: 2 entities
- API: 8 capabilities, 2 routes, stack `graphql_sdl`
- workflows: 2 workflows, 4 transitions

Canonical adopted concepts:

- `post`
- `user`

Canonical outputs now live under:

- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/entities](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/capabilities](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/shapes](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/decisions](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/docs/workflows)

## Key Point

There are now two useful GraphQL proof points:

- SDL-authored GraphQL: [graphql-sdl-first](/Users/attebury/Documents/topogram/docs/brownfield-trial-graphql-sdl-first.md)
- code-first GraphQL with committed generated schema: this Nexus trial

So the current boundary is narrower than “GraphQL code-first is unsupported”.

The more precise boundary is:

- supported now: code-first GraphQL repos that commit generated schema SDL
- next deeper step: raw source-only GraphQL schema/resolver inference when no generated schema file exists

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/candidates/app/report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus/topogram/candidates/reconcile/adoption-status.md)
