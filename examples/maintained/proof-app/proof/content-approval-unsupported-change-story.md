# Content Approval Unsupported Change Story

## Goal

Show the other half of the Topogram thesis:

- not every change should be automated
- unsafe DB evolution should stop clearly
- the agent should be guided toward a manual decision instead of generating misleading SQL

This proof uses the same `content-approval` workflow domain, but focuses on unsafe enum changes rather than the safe additive `needs_revision` rollout.

## The Unsafe Change Class

The engine now distinguishes between:

- additive enum expansion
  - safe to automate
  - example: adding `needs_revision`
- non-additive enum change
  - unsafe to automate
  - examples: removing a value, renaming a value, or incompatible reorder

For `article_status`, these unsafe cases include:

- removing a value
- renaming a value
- moving an existing value into a new order that cannot be represented as an additive insert

## Seam Summary

- seam: `seam_unsupported_relation_and_workflow_meaning_changes`
- output: `maintained_app`
- emitted dependencies:
  - `journey_editorial_review_and_revision`
  - `proj_api`
  - `proj_web`
- review class: `no_go`

## Why Topogram Stops

Enum changes are not just shape changes. They can imply:

- persisted rows using old values
- application logic depending on old values
- rollout ordering constraints between app code and DB state
- backend/runtime assumptions that a generator cannot safely infer away

That means “generate some SQL and hope” is the wrong behavior.

Instead, Topogram now treats these as manual changes.

## What The Engine Now Proves

The engine suite includes explicit negative planner proofs for Content Approval:

- enum removal
- enum rename
- incompatible enum reorder

Those tests live in:

- [engine/scripts/test.js](../../../../engine/scripts/test.js)

In all three cases, the generated migration plan must:

- set `supported: false`
- include manual `alter_enum` actions
- avoid pretending the change is additive

## Lifecycle Stop Behavior

The proof does not stop at the planner.

The generated SQLite lifecycle bundle is also exercised against an unsafe brownfield snapshot. In that case:

- `db-migrate.sh` runs
- `migration.plan.json` is written
- the plan reports manual intervention
- the script stops before generating `migration.sql`
- the script prints a clear manual-migration message

That matters because it proves the runtime automation boundary is consistent with the planning boundary.

## Why This Matters For Agents

This is a crucial agent-guided software proof:

- a human changes Topogram
- an agent derives the DB impact
- Topogram can say “yes, automate this” for additive changes
- Topogram can also say “no, this requires judgment” for unsafe changes

Without this stop behavior, the system would be biased toward overconfident automation.

The point is not only to generate more code.
The point is to make agents safer and more truthful about what can be changed automatically.

## Relationship To The Safe `needs_revision` Story

These two documents should be read together:

- [content-approval-db-change-story.md](./content-approval-db-change-story.md)
- [content-approval-unsupported-change-story.md](./content-approval-unsupported-change-story.md)

Together they show:

- one additive change that should flow through model, migration, generated runtime, and maintained app
- one unsafe class of change that should stop at the DB boundary and require manual intervention

That combination is a much stronger proof than either story alone.

## Verification

The stop behavior is covered by:

- `cd ./engine && npm test`

The relevant assertions verify:

- planner-level enum removal/rename/reorder all require manual intervention
- lifecycle migration stops before SQL is generated when the current snapshot reflects an unsafe enum shape

## Takeaway

Topogram is stronger when it can say both:

- “this additive change is safe to automate”
- “this change is not safe to automate yet”

This unsupported-change proof is the no-go counterpart to the `needs_revision` rollout proof, and it is essential if Topogram is meant to guide real software evolution rather than only generate happy-path scaffolds.
