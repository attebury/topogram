# Todo Project Owner Unsupported Change Story

## Goal

Show that Topogram treats foreign-key retargeting as a no-go automation case, even when the surrounding change looks small.

## Scenario

The current Todo model makes `projects.owner_id` point to `entity_user.id`.

The unsafe brownfield scenario is a stale database snapshot where `projects.owner_id` points somewhere else, for example:

- `entity_project.id`

That kind of change is not just an additive field or enum expansion. It changes the meaning of stored data and can invalidate existing rows.

## Expected Planner Behavior

The migration planner should:

- keep the intended next-state foreign key in `operations` as an `add_foreign_key`
- add a manual `drop_foreign_key` action for the stale relation
- mark the overall plan as unsupported

That is the important safety boundary: Topogram can describe the desired end state, but it should not guess how to rewrite a live foreign-key relationship automatically.

## Seam Summary

- seam: `seam_ownership_retargeting_remains_manual`
- output: `maintained_app`
- emitted dependencies:
  - `entity_project`
  - `proj_api`
  - `proj_web`
- review class: `no_go`

## Expected Lifecycle Behavior

When the SQLite lifecycle bundle runs against that stale snapshot, it should:

1. write `migration.plan.json`
2. mark the plan as manual
3. stop before writing `migration.sql`

That prevents a generated script from silently mutating a relational constraint with unclear data consequences.

## Expected Maintained-App Behavior

The maintained app should also refuse to treat this as a routine guided update.

In `product/app/src/todo-change-guards.js`, the proof app now models this as a guarded decision point:

- unchanged `owner_id -> entity_user.id` stays auto-guidable
- retargeting `owner_id` to some other entity requires `manualDecisionRequired = true`

That mirrors the real product claim more closely:

- Topogram can identify the impact
- an agent can surface the exact semantic drift
- but the maintained app still preserves a human judgment boundary for changes that alter ownership meaning

## Why This Matters

This is the relational counterpart to the enum no-go proof:

- additive changes can often be generated safely
- destructive or ambiguous relational changes must stop and ask for human judgment

For agent-guided software evolution, that boundary is as important as successful code generation. A system that cannot say “no” clearly is not safe enough for brownfield change work.
