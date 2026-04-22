# Brownfield Trial: Clean Architecture Delivery Example

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example`
- Source: `eliostvs/clean-architecture-delivery-example`

## What This Trial Proved

This trial confirmed that the Java import path is not limited to RealWorld-style conventions. Topogram can also recover a credible business-domain model from a layered Spring MVC + JPA app with a non-RealWorld domain:

- customer
- order
- product
- store
- cousine

It also proves that the shared reconcile/adoption pipeline still works when controller/resource names and persistence types no longer look like the other Spring trials.

## Import Coverage

Current Java/Spring coverage used by this trial includes:

- `api/spring-web`
  - annotation-driven Spring MVC resources from `*Resource` interfaces
  - mixed-case route prefixes like `/Store`, `/Product`, `/Order`, `/Cousine`, `/Customer`
  - nested action handling for search, payment, and delivery routes
- `db/jpa`
  - `@Entity` parsing
  - field extraction
  - relation inference from JPA annotations
  - enum extraction
  - low-signal child entity suppression for `orderitem`

## Imported Domain Surface

Recovered core bundles:

- `customer`
- `order`
- `product`
- `store`
- `cousine`
- `account`

Suppressed implementation-noise bundle:

- `orderitem`

## Canonical Outputs

The trial now has canonical Topogram outputs under:

- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/enums`
- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/docs/workflows`

Representative adopted canonical concepts include:

- `customer`
- `order`
- `product`
- `store`
- `cousine`
- `account`

## Completion Signal

Saved status is now fully closed:

- `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example/topogram/candidates/reconcile/adoption-status.md`
- `Next Bundle: None`
- `Blocked items: 0`

## Why This Is Enough To Move Forward

This is the Java clean-architecture proof because Topogram can now:

- recover business concepts from Spring resource interfaces instead of only conventional controllers
- combine JPA entity evidence with route evidence into stable bundles
- preserve non-RealWorld concepts like `order`, `store`, and `cousine`
- close the queue without adopting implementation-noise entities just to clear status

## Deferred For Java v1

- deeper use-case/service graph inference
- Java UI extraction
- broader Java framework support outside the current Spring MVC + Liquibase/MyBatis/JPA paths
