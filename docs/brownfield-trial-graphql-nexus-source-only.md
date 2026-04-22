# Brownfield Trial: GraphQL Nexus Source Only

Source repo basis:

- [`prisma-examples/orm/graphql-nexus`](https://github.com/prisma/prisma-examples/tree/latest/orm/graphql-nexus)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only)

## Goal

Prove raw Nexus code-first GraphQL import without relying on a committed generated SDL artifact.

This trial was created from the Nexus example with:

- `schema.graphql` removed

That makes it a true source-only Nexus test.

## What Was Added

The GraphQL code-first extractor now also parses Nexus source patterns directly from `schema.ts`, including:

- `objectType({ name: 'Query' ... })`
- `objectType({ name: 'Mutation' ... })`
- `objectType({ name: 'User' ... })`
- `objectType({ name: 'Post' ... })`
- `inputObjectType(...)`

Relevant implementation:

- [engine/src/import/extractors/api/graphql-code-first.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/api/graphql-code-first.js)

## Trial Result

Import summary:

- DB: 2 entities
- API: 8 capabilities, 2 routes, stack `graphql_code_first`
- workflows: 2 workflows, 4 transitions

Canonical adopted concepts:

- `post`
- `user`

Canonical outputs now live under:

- [/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/entities](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/capabilities](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/shapes](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/decisions](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/decisions)

## Why This Matters

This completes the first practical source-only GraphQL spread across:

- Nest decorators
- Pothos raw builder fields
- Nexus raw objectType/inputObjectType definitions

At this point, Topogram can recover and adopt meaningful GraphQL model surface from multiple code-first patterns without needing a generated schema file checked into the repo.

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/candidates/app/report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only/topogram/candidates/reconcile/adoption-status.md)
