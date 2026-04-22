# Brownfield Trial: Django RealWorld Example App

Source repo basis:

- [`gothinkster/django-realworld-example-app`](https://github.com/gothinkster/django-realworld-example-app)

Local trial workspace:

- [./trials/django-realworld-example-app](../trials/django-realworld-example-app)

## Goal

Pressure the extractor-registry architecture against a Django + Django REST Framework codebase with:

- `models.py` domain models
- `urls.py` routing
- DRF `APIView` / `GenericViewSet` classes
- DRF serializers

This first Django pass intentionally leaves UI/template import out of scope.

## What Was Added

Django-specific import support now includes:

- DB extractor for Django `models.py`
- API extractor for Django `urls.py` and DRF router/view patterns
- DRF enricher for:
  - serializer-driven input/output shape hints
  - auth hints
  - query param hints
  - workflow target states

Relevant implementation:

- [engine/src/import/extractors/db/django-models.js](../engine/src/import/extractors/db/django-models.js)
- [engine/src/import/extractors/api/django-routes.js](../engine/src/import/extractors/api/django-routes.js)
- [engine/src/import/enrichers/django-rest.js](../engine/src/import/enrichers/django-rest.js)

## Trial Result

Import summary:

- DB: 5 entities, 7 relations
- API: 18 capabilities, 18 routes, stack `django`
- workflows: 6 workflows, 9 transitions

Recovered domain concepts include:

- entities:
  - `article`
  - `comment`
  - `tag`
  - `user`
  - `profile`
- capability surfaces:
  - `account`
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`

The curated canonical surface is now fully adopted for:

- entities:
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`
- capability/workflow surface:
  - `account`
- workflow docs and decisions:
  - `account`
  - `article`
  - `comment`
  - `profile`
  - `tag`
  - `user`

Canonical outputs now exist under:

- [./trials/django-realworld-example-app/topogram/entities](../trials/django-realworld-example-app/topogram/entities)
- [./trials/django-realworld-example-app/topogram/capabilities](../trials/django-realworld-example-app/topogram/capabilities)
- [./trials/django-realworld-example-app/topogram/shapes](../trials/django-realworld-example-app/topogram/shapes)
- [./trials/django-realworld-example-app/topogram/decisions](../trials/django-realworld-example-app/topogram/decisions)
- [./trials/django-realworld-example-app/topogram/docs/workflows](../trials/django-realworld-example-app/topogram/docs/workflows)

## Why This Matters

This trial shows that Topogram can now recover a real Django API surface without relying on:

- Prisma or SQL schema snapshots
- OpenAPI
- frontend route extraction

It also validates that the same shared reconcile/adoption pipeline still works once the framework-specific extraction shifts to:

- Django models
- Django `url(...)` routing
- DRF serializers and API views

It is now enough to move on because:

- the main RealWorld backend domain was imported cleanly
- all six meaningful domain/auth bundles were reconciled and adopted canonically
- adoption status shows no remaining real bundle work
- the remaining Django gaps are refinement work, not proof blockers

## Current Queue

The curated Django queue is complete:

- `article`
- `profile`
- `user`
- `comment`
- `tag`
- `account`

Current status artifact:

- [Adoption status](../trials/django-realworld-example-app/topogram/candidates/reconcile/adoption-status.md)

Completion signal:

- `Next Bundle: None`
- `Blocked items: 0`

## Remaining Django v1 Boundaries

Still intentionally out of scope for this milestone:

- Django template / server-rendered UI extraction
- deeper serializer nesting semantics beyond the current first-pass shape hints
- richer model semantics like validation/policy inference beyond the current field/relation pass

## Useful Artifacts

- [App import report](../trials/django-realworld-example-app/topogram/candidates/app/report.md)
- [Reconcile report](../trials/django-realworld-example-app/topogram/candidates/reconcile/report.md)
- [Adoption status](../trials/django-realworld-example-app/topogram/candidates/reconcile/adoption-status.md)
- [Canonical entities](../trials/django-realworld-example-app/topogram/entities)
- [Canonical capabilities](../trials/django-realworld-example-app/topogram/capabilities)

## Journey Draft Proof

This trial is also the current brownfield proof for the journey-draft path.

The supported order is:

1. `import app`
2. `reconcile`
3. inspect bundle journey drafts under `candidates/reconcile/model/bundles/*/docs/journeys/*.md`
4. `reconcile adopt journeys --write`
5. review and refine canonical journey docs under `topogram/docs/journeys/*.md`

Example commands from [engine](../engine):

```bash
node ./src/cli.js import app ../trials/django-realworld-example-app --from db,api,ui,workflows --write
node ./src/cli.js reconcile ../trials/django-realworld-example-app
node ./src/cli.js reconcile adopt journeys ../trials/django-realworld-example-app --write
```

What this proves:

- `reconcile` now emits review-required candidate journey drafts inside bundle outputs such as:
  - [./trials/django-realworld-example-app/topogram/candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md](../trials/django-realworld-example-app/topogram/candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md)
  - [./trials/django-realworld-example-app/topogram/candidates/reconcile/model/bundles/account/docs/journeys/account_journey.md](../trials/django-realworld-example-app/topogram/candidates/reconcile/model/bundles/account/docs/journeys/account_journey.md)
- `reconcile adopt journeys --write` promotes only journey docs, not workflow docs or structural artifacts
- canonical journey outputs land under:
  - [./trials/django-realworld-example-app/topogram/docs/journeys](../trials/django-realworld-example-app/topogram/docs/journeys)

Current boundary:

- these journey drafts are inferred and review-required
- journey promotion is explicit, not automatic
- canonical journey prose should still be reviewed and refined before being treated as long-lived reference documentation
