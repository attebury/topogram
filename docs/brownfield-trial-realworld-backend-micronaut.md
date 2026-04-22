# Brownfield Trial: RealWorld Backend Micronaut

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut`
- Source: `alexey-lapin/realworld-backend-micronaut`

## What This Trial Proved

This trial confirmed that the Java proof generalizes to Micronaut as a separate platform, not just Spring. Topogram can now recover a credible RealWorld backend/domain model from a Micronaut + Liquibase app with:

- annotation-driven Micronaut controllers
- Liquibase changelog schema evidence
- RealWorld auth, article, comment, profile, tag, and user flows
- join/link suppression for article-tag, follow, and favorite implementation tables

## Import Coverage

Current Java coverage used by this trial includes:

- `api/micronaut`
  - class-level and method-level route annotations
  - path/query/body extraction
  - nested action handling for feed, favorite, follow, and auth routes
- `db/liquibase`
  - changelog XML parsing
  - field and relation recovery
  - noise suppression for low-signal relationship tables

## Imported Domain Surface

Recovered core bundles:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

Suppressed implementation-noise bundles:

- `article-tag`
- `follow-relation`
- `article-favorite`

## Canonical Outputs

The trial now has canonical Topogram outputs under:

- [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/entities](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/capabilities](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/shapes](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/decisions](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/docs/workflows)

Representative adopted canonical concepts include:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

## Completion Signal

Saved status is now fully closed:

- [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/candidates/reconcile/adoption-status.md](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut/topogram/candidates/reconcile/adoption-status.md)
- `Next Bundle: None`
- `Blocked items: 0`

## Why This Is Enough To Move Forward

This is the Micronaut proof because Topogram can now:

- recover the RealWorld domain from Micronaut routing instead of Spring MVC or JAX-RS resources
- preserve important nested actions like favorite, unfavorite, follow, and feed
- use Liquibase evidence to stabilize canonical entities while suppressing relationship-noise tables
- reconcile and adopt the full curated surface cleanly

## Deferred For Java v1

- deeper Micronaut DI/service-layer inference
- Java UI extraction
- broader Java framework families beyond the now-proven Spring, Quarkus, Micronaut, and JAX-RS paths
