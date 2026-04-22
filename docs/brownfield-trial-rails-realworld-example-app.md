# Brownfield Trial: Rails RealWorld Example App

Source repo basis:

- [`alexeymezenin/ruby-on-rails-realworld-example-app`](https://github.com/alexeymezenin/ruby-on-rails-realworld-example-app)

Local trial workspace:

- [/Users/attebury/Documents/topogram/trials/rails-realworld-example-app](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app)

## Goal

Prove that Topogram can import, reconcile, and selectively adopt a convention-heavy Rails API app as a curated domain proof rather than a raw schema dump.

This trial specifically targeted:

- Rails `db/schema.rb`
- Rails `config/routes.rb`
- Rails models for association and validation meaning
- Rails controllers for auth, params, output-shape, and workflow hints

UI/view extraction was intentionally left out of scope for this Rails v1 pass.

## What Was Added

Rails-specific extraction and enrichment now includes:

- DB extractor for `db/schema.rb`
- API extractor for `config/routes.rb`
- model enricher for:
  - required and unique field hints
  - association metadata
  - join-table / implementation-noise classification
- controller enricher for:
  - auth hints
  - input/output field hints
  - workflow target-state hints

Relevant implementation:

- [engine/src/import/extractors/db/rails-schema.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/db/rails-schema.js)
- [engine/src/import/extractors/api/rails-routes.js](/Users/attebury/Documents/topogram/engine/src/import/extractors/api/rails-routes.js)
- [engine/src/import/enrichers/rails-models.js](/Users/attebury/Documents/topogram/engine/src/import/enrichers/rails-models.js)
- [engine/src/import/enrichers/rails-controllers.js](/Users/attebury/Documents/topogram/engine/src/import/enrichers/rails-controllers.js)

## Trial Result

Import summary:

- DB: 7 entities, 3 relations
- API: 19 capabilities, 20 routes, stack `rails`
- workflows: 6 workflows, 10 transitions

The curated canonical surface adopted for this trial is:

- entities:
  - `article`
  - `comment`
  - `user`
  - `tag`
- capability surfaces:
  - `account`
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`
- workflow docs and decisions:
  - `account`
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`

Canonical outputs now live under:

- [/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/entities](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/capabilities](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/shapes](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/decisions](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/docs/workflows)

## Curated Suppression

This trial intentionally suppresses Rails implementation-noise bundles instead of adopting them as first-class canonical concepts:

- `articles-tag`
- `articles-user`
- `follower`

Why:

- `articles-tag` and `articles-user` are HABTM join tables
- `follower` is a self-join backing user follow relationships
- these are useful as import evidence, but not good canonical domain entities for this proof

The reconcile report records them as suppressed noise bundles instead of keeping them at the top of the adoption queue.

## Why This Matters

This trial shows that Topogram can now handle a convention-heavy Rails backend without needing:

- OpenAPI
- explicit frontend route trees
- manually curated import hints

It also validates the architectural split:

- framework-specific extraction at the edges
- shared reconcile and adoption in the middle

## Remaining Rails v1 Boundaries

Still intentionally out of scope for this milestone:

- Rails view/template/UI extraction
- deeper ActiveRecord semantic modeling beyond the current model/controller evidence
- treating join-table plumbing as standalone canonical concepts

## Useful Artifacts

- [App import report](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/candidates/app/report.md)
- [Reconcile report](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/candidates/reconcile/report.md)
- [Adoption status](/Users/attebury/Documents/topogram/trials/rails-realworld-example-app/topogram/candidates/reconcile/adoption-status.md)
