# Brownfield Trial: Supabase Express API

## Trial Target

Repository:

- `trials/supabase-express-api`

Why this trial matters:

- real backend-first app, not a curated example
- Drizzle schema source
- Express route structure
- code-generated OpenAPI source
- admin, membership, and audit-log domain surfaces

## Golden Path

Run these from [engine](../engine) against [trials/supabase-express-api](../trials/supabase-express-api):

```bash
node ./src/cli.js import app ../trials/supabase-express-api --from db,api,ui,workflows
node ./src/cli.js import docs ../trials/supabase-express-api
node ./src/cli.js report gaps ../trials/supabase-express-api
node ./src/cli.js reconcile ../trials/supabase-express-api
node ./src/cli.js adoption status ../trials/supabase-express-api
```

Add `--write` when you want those commands to refresh the saved candidate and report files on disk.

Current expected signals from the live CLI:

- `import app`
  - `db`: 5 entities, 1 enum
  - `api`: 19 capabilities, 21 routes
  - `ui`: backend-only, 0 screens, 0 routes
  - `workflows`: 5 workflows, 7 transitions
- `import docs`
  - 1 README source
  - low-value glossary noise plus 2 inferred workflow docs
- `report gaps`
  - `topogram_available: false` when run against the raw repo root before canonical adoption is considered
- `reconcile`
  - 48 applied adoption items
  - 0 blocked items
  - 6 candidate bundles
  - workflow review groups for `account`, `audit-log`, `profile`, `workspace`, and `workspace-membership`
- `adoption status`
  - `Next Bundle: None`
  - all 6 bundles complete

Saved proof artifacts for this walkthrough:

- [App import report](../trials/supabase-express-api/topogram/candidates/app/report.md)
- [Gap report](../trials/supabase-express-api/topogram/candidates/reports/gap-report.md)
- [Reconcile report](../trials/supabase-express-api/topogram/candidates/reconcile/report.md)
- [Adoption status](../trials/supabase-express-api/topogram/candidates/reconcile/adoption-status.md)

## Closure Criteria

Treat this proof as closed when all of the following are true:

- canonical files exist under [trials/supabase-express-api/topogram](../trials/supabase-express-api/topogram)
- reconcile reports `blocked items: 0`
- adoption status reports `Next Bundle: None`
- workflow review groups are present only as already approved/applied history, not as pending blockers
- UI is explicitly reported as backend-only instead of silently missing

## What Worked

### DB import

- Drizzle import produced clean domain entities:
  - `account`
  - `workspace`
  - `workspace-membership`
  - `profile`
  - `audit-log`
- enum inference worked for:
  - `workspace-membership_role`

### API import

- code-generated OpenAPI import worked from `src/docs/openapi.ts`
- route clustering improved enough to separate:
  - `account`
  - `workspace`
  - `workspace-membership`
  - `profile`
  - `audit-log`
- auth and response-shape extraction worked for:
  - `cap_sign_in_account`
  - `cap_register_account`
  - `cap_list_workspaces`
  - `cap_list_audit_logs`

### Reconcile / adoption

- reconcile produced reviewable concept bundles
- selective adoption successfully promoted canonical Topogram files for:
  - entities
  - enum
  - capabilities
  - shapes
  - workflow docs
  - decisions

The adopted canonical model now includes:

- `entity_account`
- `entity_workspace`
- `entity_workspace-membership`
- `entity_profile`
- `entity_audit-log`
- `workspace-membership_role`

plus the imported capability and workflow surfaces for those concepts.

One important nuance from the current engine behavior: this proof still records `workflow_review:*` groups for the inferred workflow docs and decisions, but those groups are already approved and the related adoption items are already applied. In other words, this repo is not just review-ready; it is already in a completed adopted state.

## Main Gaps Exposed

### UI import

This repo is backend-only from the perspective of supported UI extractors.

That led to an explicit `backend_only` UI result, which is better than a silent failure, but it also confirms:

- UI import needs stack-aware no-op reporting
- not every brownfield repo should be forced through a frontend interpretation

### Docs noise

README scanning still over-produces low-value glossary candidates in larger backend repos.

### Capability semantics

Even after clustering improvements, some imported capabilities still reflect transport-oriented semantics more than ideal domain semantics, especially around:

- admin-only endpoints
- stats endpoints
- status/role updates

## Why This Trial Was Valuable

This trial proved that the brownfield flow works on a non-Next, non-example backend stack:

- import
- docs scan
- gap reporting
- reconcile
- selective adoption

It also validated the extractor-registry direction, because the useful improvements were all framework/source-specific:

- Drizzle extractor
- Express extractor
- OpenAPI-code extractor

while reconcile and adoption stayed shared.

It is also the cleanest current example of a backend-only brownfield repo reaching a fully closed adoption state without inventing an artificial frontend surface.

## Recommended Next Trials

- tRPC app
- Fastify app
- GraphQL app
- Remix or Next Pages Router app
