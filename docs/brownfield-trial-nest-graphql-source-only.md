# Brownfield Trial: Nest GraphQL Source Only

Source repo basis:

- [`prisma-examples/orm/nest-graphql`](https://github.com/prisma/prisma-examples/tree/latest/orm/nest-graphql)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/nest-graphql-source-only](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only)

## Goal

Prove that Topogram can import and adopt a real code-first GraphQL app even when no committed SDL/schema artifact is present.

This trial was created from the Nest GraphQL example with the generated schema file removed:

- removed: `src/schema.gql`

That makes it the first local proof for true source-only GraphQL inference.

## What Was Added

Topogram gained a source-only GraphQL code-first extractor:

- [engine/src/import/extractors/api/graphql-code-first.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/api/graphql-code-first.js)

The initial implementation targets the Nest GraphQL decorator pattern:

- `@Resolver`
- `@Query`
- `@Mutation`
- `@Args`
- `@InputType`
- `@ObjectType`
- `GraphQLModule.forRoot(...)`

It infers:

- candidate capabilities
- input field hints from `@Args` and nested `@InputType` classes
- output field hints from `@ObjectType` classes
- workflow transitions from inferred GraphQL mutations

## Trial Result

Import summary:

- DB: 2 entities
- API: 8 capabilities, 2 routes, stack `graphql_code_first`
- UI: backend-only
- workflows: 2 workflows, 4 transitions

Canonical adopted concepts:

- `post`
- `user`

Canonical outputs now live under:

- [/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/entities](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/capabilities](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/shapes](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/decisions](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/docs/workflows)

## Why This Matters

This narrows the remaining GraphQL gap substantially.

Current support now includes:

- SDL-authored GraphQL
- code-first GraphQL with committed generated schema
- source-only Nest GraphQL decorators without committed schema

The next GraphQL depth step is no longer “support source-only GraphQL at all”.

It is:

- broaden source-only GraphQL support beyond Nest decorators
- cover Pothos/Nexus raw source patterns when generated schema is absent
- improve nested output modeling beyond flat field lists

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/candidates/app/report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/nest-graphql-source-only/topogram/candidates/reconcile/adoption-status.md)
