# Brownfield Trial: RealWorld API Quarkus

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/realworld-api-quarkus`
- Source: `diegocamara/realworld-api-quarkus`

## What This Trial Proved

This trial confirmed that the Java proof generalizes beyond Spring. Topogram can now recover a credible RealWorld backend/domain model from a Quarkus + JAX-RS + JPA app with:

- JAX-RS resource classes and subresource paths
- JPA entities as primary DB/domain evidence
- RealWorld auth, article, comment, profile, tag, and user flows
- join/link relationship suppression for favorites, follows, and article-tag linkage

## Import Coverage

Current Java coverage used by this trial includes:

- `api/jaxrs`
  - class-level and method-level `@Path`
  - `@GET`, `@POST`, `@PUT`, `@PATCH`, `@DELETE`
  - nested subresource path handling
  - path/query/body extraction from JAX-RS resource methods
- `db/jpa`
  - `@Entity` parsing
  - field extraction
  - relation inference from JPA annotations
  - low-signal relationship entity suppression during reconcile

## Imported Domain Surface

Recovered core bundles:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

Suppressed implementation-noise bundles:

- `favorite-relationship`
- `follow-relationship`
- `tag-relationship`

## Canonical Outputs

The trial now has canonical Topogram outputs under:

- [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/entities](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/capabilities](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/shapes](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/decisions](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/docs/workflows)

Representative adopted canonical concepts include:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

## Completion Signal

Saved status is now fully closed:

- [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/candidates/reconcile/adoption-status.md](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus/topogram/candidates/reconcile/adoption-status.md)
- `Next Bundle: None`
- `Blocked items: 0`

## Why This Is Enough To Move Forward

This is the Quarkus proof because Topogram can now:

- recover a RealWorld domain from JAX-RS resource routing instead of Spring annotations
- preserve nested actions like favorite, unfavorite, follow, and feed
- combine JPA entity evidence with route evidence into stable bundles
- close the queue without adopting relationship-link entities just to clear status

## Deferred For Java v1

- deeper Quarkus/Panache-specific inference beyond current JPA coverage
- Java UI extraction
- service-layer semantic reconstruction beyond route and entity evidence
