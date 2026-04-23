# Content Approval DB Change Story

## Goal

Show one Topogram change all the way through:

1. model change
2. realization and contract impact
3. DB migration outcome
4. hand-maintained app edits
5. verification

This proof uses the `content-approval` workflow change that introduced `needs_revision`.

## The Topogram Change

The Content Approval model changed in these ways:

- `article_status` gained `needs_revision`
- `entity_article` gained `revision_requested_at`
- a new capability `cap_request_article_revision` was added
- resubmission stayed on the existing `cap_update_article` capability with `status=submitted`

Relevant model files:

- [examples/generated/content-approval/topogram/enums/enum-article-status.tg](../../../../examples/generated/content-approval/topogram/enums/enum-article-status.tg)
- [examples/generated/content-approval/topogram/entities/entity-article.tg](../../../../examples/generated/content-approval/topogram/entities/entity-article.tg)
- [examples/generated/content-approval/topogram/capabilities/cap-request-article-revision.tg](../../../../examples/generated/content-approval/topogram/capabilities/cap-request-article-revision.tg)
- [examples/generated/content-approval/topogram/projections/proj-api.tg](../../../../examples/generated/content-approval/topogram/projections/proj-api.tg)

## Realization And Contract Impact

That change affects all three major realization surfaces:

- `ApiRealization`
  - article detail now includes `revision_requested_at`
  - the API surface now includes `POST /articles/:id/request-revision`
- `DbRealization`
  - the persisted article state now includes `revision_requested_at`
  - the Postgres/SQLite snapshots now include the expanded `article_status` enum
- `WebAppRealization`
  - article detail now exposes a request-revision action
  - article edit now acts as the resubmission path when status is `needs_revision`

This is the important part of the proof: the change is not only visible in generated UI. It changes the engine-owned contract surfaces too.

## Migration Outcome

The additive brownfield migration proof starts from a pre-change snapshot:

- [examples/generated/content-approval/topogram/tests/fixtures/migrations/proj_db_postgres.needs-revision-from.snapshot.json](../../../../examples/generated/content-approval/topogram/tests/fixtures/migrations/proj_db_postgres.needs-revision-from.snapshot.json)

From that snapshot, Topogram now generates this supported migration plan:

- [examples/generated/content-approval/topogram/tests/fixtures/expected/proj_db_postgres.needs-revision.db-migration-plan.json](../../../../examples/generated/content-approval/topogram/tests/fixtures/expected/proj_db_postgres.needs-revision.db-migration-plan.json)

The key operations are:

- `add_enum_value` for `article_status.needs_revision`
- `add_column` for `articles.revision_requested_at`

And the generated SQL is:

- [examples/generated/content-approval/topogram/tests/fixtures/expected/proj_db_postgres.needs-revision.migration.sql](../../../../examples/generated/content-approval/topogram/tests/fixtures/expected/proj_db_postgres.needs-revision.migration.sql)

The lifecycle path is also proven now, not just the planner:

- generated SQLite lifecycle bundles bootstrap from empty
- brownfield SQLite bundles migrate from the pre-change snapshot
- `current.snapshot.json` is rewritten to the desired schema after migration

Negative safety is also covered:

- enum removal
- enum rename
- incompatible enum reorder

Those cases now require manual intervention instead of silently generating SQL.

## Hand-Maintained App Edits

The maintained proof app was updated without treating it as disposable generated code.

Updated maintained files:

- [examples/maintained/proof-app/src/content-approval.js](../src/content-approval.js)
- [examples/maintained/proof-app/src/content-approval-ui.js](../src/content-approval-ui.js)
- [examples/maintained/proof-app/src/content-approval-actions.js](../src/content-approval-actions.js)

What changed in that code:

- presenter output now includes `revision_requested_at`
- route and detail metadata now understand `needs_revision`
- the maintained UI layer exposes request-revision and resubmission affordances
- the maintained mutation layer builds request-revision and resubmission payloads from workflow-aware input

This is the core claim the proof is trying to support:

- a human changes Topogram
- an agent derives the contract impact
- the agent patches maintained app code safely
- verification confirms both the generated and maintained surfaces

## Verification

Generated and maintained verification now covers the whole story.

Maintained app:

- `cd ./examples/maintained/proof-app && node ./scripts/compile-check.mjs`
- `cd ./examples/maintained/proof-app && node ./scripts/smoke.mjs`
- `cd ./examples/maintained/proof-app && node ./scripts/runtime-check.mjs`

Engine and examples:

- `cd ./engine && npm test`
- `cd ./engine && node ./src/cli.js ../examples/generated/content-approval/topogram --validate`

The engine suite now proves all of these:

- additive enum expansion is supported
- additive field migration is supported
- unsafe enum changes are manual
- lifecycle scripts stop before unsafe SQL is applied
- the maintained app still matches the changed workflow semantics

## Why This Matters

This is a stronger proof than simple code generation.

It shows that one Topogram change can drive:

- model evolution
- DB migration planning
- lifecycle safety checks
- generated runtime updates
- maintained app edits

That is much closer to the actual Topogram thesis than “generate a fresh app and run it.”
