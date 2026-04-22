# Brownfield Trial: Next.js GraphQL Source Only

Source repo basis:

- [`prisma-examples/orm/nextjs-graphql`](https://github.com/prisma/prisma-examples/tree/latest/orm/nextjs-graphql)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only)

## Goal

Prove raw Pothos code-first GraphQL import without relying on any committed generated SDL artifact.

This trial was created by copying the Next.js GraphQL example and removing:

- `generated/schema.graphql`

That makes it a true source-only Pothos GraphQL test.

## What Was Added

The GraphQL code-first extractor was extended beyond Nest decorators so it can also parse raw Pothos source patterns such as:

- `builder.prismaObject(...)`
- `builder.queryField(...)`
- `builder.mutationField(...)`
- `builder.inputType(...)`

Relevant implementation:

- [engine/src/import/extractors/api/graphql-code-first.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/api/graphql-code-first.js)

## Trial Result

Import summary:

- DB: 2 entities
- API: 6 capabilities, 2 routes, stack `graphql_code_first`
- workflows: 2 workflows, 4 transitions

Canonical adopted concepts:

- `post`
- `user`

Canonical outputs now live under:

- [/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/entities](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/capabilities](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/shapes](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/decisions](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/decisions)

## Why This Matters

This is the first saved proof for raw Pothos source-only GraphQL.

Taken together, GraphQL support now covers:

- SDL-authored GraphQL
- code-first GraphQL with committed generated schema
- source-only Nest GraphQL decorators
- source-only Pothos GraphQL fields and objects

That moves the remaining GraphQL gap from “can we do source-only code-first GraphQL at all?” to “how broad and deep should that raw source support become next?”

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/candidates/app/report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only/topogram/candidates/reconcile/adoption-status.md)
