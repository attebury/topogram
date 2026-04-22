# Product App Proof

This folder is a small hand-maintained proof app.

It is intentionally not generator-owned. Its purpose is to prove the workflow:

1. read a Topogram change
2. derive the impacted UI/API contract
3. patch a hand-maintained app
4. run compile/smoke/runtime checks

This is also the clearest current Topogram wedge proof:

- a human changes Topogram
- emitted contracts and journeys move
- a maintained app mirrors the structurally safe parts
- manual-decision and no-go boundaries stay explicit

## Current Proof Scenarios

The proof now exercises two maintained-app update stories:

- `content-approval`
  - article workflow contract now includes `needs_revision` and `revision_requested_at`
- `issues`
  - issue detail ownership visibility now carries owner-or-admin action semantics for edit and close behavior
  - issue list/card visibility now mirrors the emitted issue list contract and compact issue-card output
- `todo`
  - task detail and mutation contracts now include first-class `priority`
  - project detail and mutation contracts now include first-class `owner_id`

Hand-maintained app updates:
- the content-approval presenter renders revision-request and review-decision fields for an article detail summary
- the content-approval UI layer derives detail-page actions plus edit/request-revision form metadata from the workflow state
- the content-approval action layer builds hand-maintained request-revision and resubmission submissions from workflow-aware form input
- the content-approval maintained proof now includes a workflow-surface guard that flags new affordances as manual-decision cases when product judgment is still needed
- the issues presenter now models ownership-based issue detail action visibility in hand-maintained code, including owner/admin allowed states and non-owner hidden states
- the issues presenter now also exposes a maintained issue-card/list summary so emitted list visibility expectations are checked alongside detail ownership behavior
- the Todo presenter renders task priority in summary and view-model metadata
- the Todo presenter now also exposes a maintained task-card/list summary so emitted list visibility expectations are checked alongside detail behavior
- the Todo presenter and route helpers render project-owner relationship data in summary and detail view-model metadata
- the Todo maintained proof app now includes a relation-change guard that marks foreign-key retargeting as a manual decision instead of an automatic edit
- both route metadata and presenter logic remain outside generator ownership

## Maintained Proof Categories

The maintained-app proof now covers three categories of change:

- accepted change
  - a maintained surface should mirror the emitted Topogram artifact directly
  - example: [proof/issues-ownership-visibility-story.md](/Users/attebury/Documents/topogram/product/app/proof/issues-ownership-visibility-story.md)
- guarded/manual-decision change
  - Topogram identifies the impacted maintained surface, but the final product or UX treatment should remain human-owned
  - example: [proof/content-approval-workflow-decision-story.md](/Users/attebury/Documents/topogram/product/app/proof/content-approval-workflow-decision-story.md)
- no-go or unsupported change
  - the system should fail clearly rather than over-automate
  - examples:
    - [proof/issues-ownership-visibility-drift-story.md](/Users/attebury/Documents/topogram/product/app/proof/issues-ownership-visibility-drift-story.md)
    - [proof/content-approval-unsupported-change-story.md](/Users/attebury/Documents/topogram/product/app/proof/content-approval-unsupported-change-story.md)
    - [proof/todo-project-owner-unsupported-change-story.md](/Users/attebury/Documents/topogram/product/app/proof/todo-project-owner-unsupported-change-story.md)

## Commands

Run these from `/Users/attebury/Documents/topogram/product/app`.

```bash
npm run verify
```

Or run the gates individually:

```bash
node ./scripts/compile-check.mjs
node ./scripts/smoke.mjs
node ./scripts/runtime-check.mjs
```

## Verification Matrix

These checks are required maintained-proof gates, not optional helpers.

- `compile-check`
  - proves the maintained presenter, UI, route, and action helpers still satisfy the current Topogram-driven contract shape
  - protects route metadata, summary rendering, workflow-surface derivation, and relation metadata assumptions
- `smoke`
  - proves the maintained proof app still behaves coherently for the minimum supported happy-path and no-go-path scenarios
  - protects the article revision-request/resubmission flow and the Todo owner-relation manual-decision guard
- `runtime-check`
  - proves the maintained proof still matches critical emitted artifact surfaces from the source Topogram packages
  - protects emitted API/OpenAPI contract fields, emitted DB relation semantics, and emitted journey/user-flow expectations before they are mirrored in maintained app behavior
  - protects the content-approval `needs_revision` and resubmission story, Todo `priority` and `owner_id` contract surfaces, and the manual-decision proofs for unsafe changes

Use all three when:

- changing `product/app`
- changing Topogram-generated contract surfaces that `product/app` mirrors
- changing proof stories under `product/app/proof`

## Current Contract Boundary

The maintained proof app now follows emitted Topogram artifacts rather than raw `.tg` source text when it decides whether the app is still aligned.

- Content Approval runtime checks read emitted OpenAPI and docs-index artifacts to confirm:
  - `needs_revision` and `revision_requested_at` still exist in the emitted contract surface
  - the canonical article resubmission journey still covers visible review context, article detail access, and resubmission through the maintained flow
- Issues runtime checks read emitted OpenAPI, UI contract, and docs-index artifacts to confirm:
  - issue detail output still exposes the ownership and lifecycle fields the maintained presenter depends on
  - emitted `issue_detail` visibility still declares owner-or-admin gating for edit and close actions with `assignee_id`
  - emitted `issue_list` still points at the compact issue-card surface with the expected filters and renamed assignee field
  - the canonical issue-resolution journey still keeps owner-only detail actions in scope
- Todo runtime checks read emitted server-contract, DB snapshot, and docs-index artifacts to confirm:
  - the emitted `task_list` screen and emitted `shape_output_task_card` still support the maintained list/card proof
  - task `priority` and `owner_id` still exist in emitted request/detail surfaces
  - project and task ownership still point at the user relation in the emitted DB contract
  - the canonical task-creation journey still covers ownership, archived-project blocking, and task list/detail visibility

This is the current maintained-app proof boundary:

- emitted contract drift
- emitted DB relation drift
- emitted journey/user-flow drift
- manual-decision guards for unsafe or ambiguous changes

The runtime proof is intentionally split into small layers:

- [scripts/emitted-contracts.mjs](/Users/attebury/Documents/topogram/product/app/scripts/emitted-contracts.mjs): emitted artifact loading and lookup helpers
- [scripts/proof-scenarios.mjs](/Users/attebury/Documents/topogram/product/app/scripts/proof-scenarios.mjs): reusable maintained-proof assertions for Todo and Content Approval
- [scripts/runtime-check.mjs](/Users/attebury/Documents/topogram/product/app/scripts/runtime-check.mjs): the composed runtime gate that runs those assertions together

For an evaluator-facing review artifact outside the generated verification loop, see:

- [proof/maintained-contract-review.md](/Users/attebury/Documents/topogram/product/app/proof/maintained-contract-review.md)

## Files

- [src/content-approval.js](/Users/attebury/Documents/topogram/product/app/src/content-approval.js): hand-maintained content-approval presenter and route metadata
- [src/content-approval-ui.js](/Users/attebury/Documents/topogram/product/app/src/content-approval-ui.js): hand-maintained Content Approval detail page and form-model logic
- [src/content-approval-actions.js](/Users/attebury/Documents/topogram/product/app/src/content-approval-actions.js): hand-maintained request-revision and resubmission action builders
- [src/todo.js](/Users/attebury/Documents/topogram/product/app/src/todo.js): hand-maintained Todo presenter and route metadata
- [proof/edit-existing-app.md](/Users/attebury/Documents/topogram/product/app/proof/edit-existing-app.md): the documented Topogram-to-app edit proof
- [proof/content-approval-db-change-story.md](/Users/attebury/Documents/topogram/product/app/proof/content-approval-db-change-story.md): the end-to-end model, migration, maintained-app, and verification story for `needs_revision`
- [proof/content-approval-unsupported-change-story.md](/Users/attebury/Documents/topogram/product/app/proof/content-approval-unsupported-change-story.md): the matching no-go story for unsafe enum changes that require manual DB intervention
- [proof/content-approval-workflow-decision-story.md](/Users/attebury/Documents/topogram/product/app/proof/content-approval-workflow-decision-story.md): the maintained-app no-go story for ambiguous workflow/UI decisions
- [proof/issues-ownership-visibility-story.md](/Users/attebury/Documents/topogram/product/app/proof/issues-ownership-visibility-story.md): the passing maintained-app proof for owner-or-admin detail visibility and compact issue-card/list alignment
- [proof/issues-ownership-visibility-drift-story.md](/Users/attebury/Documents/topogram/product/app/proof/issues-ownership-visibility-drift-story.md): the maintained-app drift story for owner-only issue detail actions
- [proof/maintained-contract-review.md](/Users/attebury/Documents/topogram/product/app/proof/maintained-contract-review.md): a hand-written contract review artifact for auditors and skeptical evaluators
- [proof/maintained-proof-checklist.md](/Users/attebury/Documents/topogram/product/app/proof/maintained-proof-checklist.md): the reusable checklist for adding the next hand-maintained proof
- [proof/todo-project-owner-unsupported-change-story.md](/Users/attebury/Documents/topogram/product/app/proof/todo-project-owner-unsupported-change-story.md): the matching no-go story for unsafe Todo foreign-key retargeting
- [scripts](/Users/attebury/Documents/topogram/product/app/scripts): local proof checks
- [scripts/emitted-contracts.mjs](/Users/attebury/Documents/topogram/product/app/scripts/emitted-contracts.mjs): shared helpers for reading emitted Topogram artifacts used by the maintained-proof runtime gate
- [scripts/proof-scenarios.mjs](/Users/attebury/Documents/topogram/product/app/scripts/proof-scenarios.mjs): shared proof assertions that keep emitted-artifact checks and maintained-app behavior checks reusable
