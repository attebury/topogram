# Brownfield Trial: Spring Boot RealWorld Example App

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app`
- Source: `gothinkster/spring-boot-realworld-example-app`

## What This Trial Proved

This trial confirmed that the Java brownfield path generalizes beyond the first Spring proof. Topogram can now recover a credible RealWorld backend/domain model from a Spring MVC + MyBatis app with:

- annotation-driven Spring MVC controllers
- SQL migration schema evidence
- MyBatis mapper XML as supporting DB/domain evidence
- RealWorld auth, article, comment, profile, tag, and user flows

## Import Coverage

Current Java/Spring coverage used by this trial now includes:

- `api/spring-web`
  - `@RestController`
  - class-level `@RequestMapping`
  - method-level `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`
  - fallback `@RequestMapping(method=...)`
  - path/query/body extraction
  - nested action handling for favorite, follow, feed, and auth routes
- `db/mybatis-xml`
  - SQL migration parsing
  - mapper XML table/reference discovery
  - join-table noise suppression for favorites, follows, and article-tag linkage

## Imported Domain Surface

Recovered core bundles:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

Suppressed implementation-noise bundles:

- `article-favorite`
- `follow`
- `article-tag`

## Canonical Outputs

The trial now has canonical Topogram outputs under:

- `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app/topogram/docs/workflows`

Representative adopted canonical concepts include:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

## Completion Signal

Saved status is now fully closed:

- `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app/topogram/candidates/reconcile/adoption-status.md`
- `Next Bundle: None`
- `Blocked items: 0`

## Why This Is Enough To Move Forward

This is a second confirmed Java/Spring proof because Topogram can now:

- recover the RealWorld domain from controller-first Spring MVC routing
- preserve important nested actions like favorite and unfavorite without collapsing them into generic CRUD
- suppress mapper/schema implementation noise by default
- reconcile and adopt the full curated canonical surface

## Deferred For Java v1

- Thymeleaf or server-rendered Java UI extraction
- deep service-layer or Spring Security policy inference
- broader Java framework families outside the proven Spring paths
