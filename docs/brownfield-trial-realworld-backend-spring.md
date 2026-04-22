# Brownfield Trial: RealWorld Backend Spring

Source repo basis:

- [`alexey-lapin/realworld-backend-spring`](https://github.com/alexey-lapin/realworld-backend-spring)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/realworld-backend-spring](/Users/attebury/Documents/topogram/trials/realworld-backend-spring)

## Goal

Pressure the extractor-registry architecture against a Spring-based Java backend with:

- Liquibase changelog schema
- Spring HTTP interface contracts via `@GetExchange` / `@PostExchange`
- controller implementations backed by command/query handlers
- auth and workflow semantics from a RealWorld-style domain

This first Java pass intentionally leaves server-rendered UI out of scope.

## What Was Added

Java/Spring-specific import support now includes:

- DB extractor for Liquibase XML changelogs
- API extractor for Spring web operation interfaces

Relevant implementation:

- [engine/src/import/extractors/db/liquibase.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/db/liquibase.js)
- [engine/src/import/extractors/api/spring-web.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/api/spring-web.js)
- [engine/src/import/core/registry.js](/Users/attebury/Documents/topogram/engine/src/import/core/registry.js)
- [engine/src/import/core/runner.js](/Users/attebury/Documents/topogram/engine/src/import/core/runner.js)

## Trial Result

Import summary:

- DB: 7 entities, 9 relations
- API: 19 capabilities, 19 routes, stack `spring`
- workflows: 6 workflows, 6 transitions

Recovered domain concepts include:

- entities:
  - `article`
  - `comment`
  - `tag`
  - `user`
- capability/workflow surfaces:
  - `account`
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`

Suppressed implementation-noise tables:

- `follow`
- `favorite`
- `article-tag`

The curated canonical surface is now fully adopted for:

- entities:
  - `article`
  - `comment`
  - `tag`
  - `user`
- capability/workflow surface:
  - `account`
  - `profile`
- workflow docs and decisions:
  - `account`
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`

Canonical outputs now exist under:

- [/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/entities](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/capabilities](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/shapes](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/decisions](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/docs/workflows)

## Why This Matters

This trial shows that Topogram can now recover a real Java backend domain without relying on:

- Prisma
- OpenAPI
- frontend route extraction

It also validates that the same shared reconcile/adoption pipeline still works once the framework-specific extraction shifts to:

- Liquibase schema XML
- Spring web interface contracts
- Java record-based request and response shapes

It is enough to move on because:

- the main RealWorld backend domain was imported cleanly
- all six meaningful domain/auth bundles were reconciled and adopted canonically
- adoption status shows no remaining real bundle work
- the remaining Java gaps are refinement work, not proof blockers

## Current Queue

The curated Java/Spring queue is complete:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

Current status artifact:

- [Adoption status](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/candidates/reconcile/adoption-status.md)

Completion signal:

- `Next Bundle: None`
- `Blocked items: 0`

## Remaining Java v1 Boundaries

Still intentionally out of scope for this milestone:

- JPA / Hibernate-specific entity extraction
- Spring MVC view / Thymeleaf extraction
- deeper service-layer policy inference beyond route and schema evidence
- broader Spring Security rule extraction beyond current auth-flow hints

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/candidates/app/report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/candidates/reconcile/adoption-status.md)
- [Canonical entities](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/entities)
- [Canonical capabilities](/Users/attebury/Documents/topogram/trials/realworld-backend-spring/topogram/capabilities)
