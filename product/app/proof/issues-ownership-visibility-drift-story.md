# Issues Ownership Visibility Drift Story

## Goal

Show that the maintained `issues` proof fails for the right reason when hand-maintained UI ownership behavior drifts away from emitted Topogram semantics.

This is not an unsafe schema-migration story.
It is a maintained-app drift story:

- emitted Topogram artifacts still describe the intended behavior correctly
- but the hand-maintained presenter stops honoring that behavior

## Scenario

The emitted `issues` UI contract now says that issue detail actions are owner-or-admin only.

In the emitted `issue_detail` screen contract:

- `cap_update_issue` uses `predicate=ownership`
- `cap_close_issue` uses `predicate=ownership`
- both use `ownershipField=assignee_id`

The canonical journey [issue-resolution-and-closure.md](../../../examples/issues/topogram/docs/journeys/issue-resolution-and-closure.md) reinforces the same intent:

- the assignee uses the normal detail flow to update and close work
- non-owners should not see owner-only detail actions as if they were allowed

The maintained proof mirrors that in:

- [product/app/src/issues.js](../src/issues.js)

## Seam Summary

- seam: `seam_owner_visibility_semantics_must_not_drift`
- output: `maintained_app`
- emitted dependencies:
  - `journey_issue_resolution_and_closure`
  - `proj_web`
- review class: `no_go`

## Intentional Drift Example

If a maintainer changes `buildIssueDetailViewModel()` so that:

- `canEdit` is always `true`, or
- `canClose` is always `true`, or
- owner checks stop using `assignee_id`

then the maintained app has drifted away from the emitted Topogram contract.

That would be the wrong kind of “helpful” maintained edit:

- the app would still render
- the route strings would still look correct
- but the action semantics would no longer match the generated source of truth

## Expected Failure Behavior

The product-app proof should fail in a clear, local way.

The expected checks to catch this drift are:

- [product/app/scripts/runtime-check.mjs](../scripts/runtime-check.mjs)
  - verifies emitted `issue_detail` visibility and the canonical `issue_resolution_and_closure` journey
  - asserts owner/admin can act and non-owners cannot
- [product/app/scripts/smoke.mjs](../scripts/smoke.mjs)
  - asserts non-owner issue detail visibility stays hidden in the maintained presenter
- [product/app/scripts/compile-check.mjs](../scripts/compile-check.mjs)
  - asserts the maintained presenter still exposes the expected detail routes and owner-visible actions

This proof matters because it shows that the maintained gate is not just checking field presence.

It is checking whether hand-maintained UI behavior still matches:

- emitted UI visibility semantics
- emitted issue detail contract shape
- emitted ownership/lifecycle journey intent

## Why This Matters

The `issues` maintained proof is our first hand-maintained auth/ownership proof.

That makes drift behavior especially important:

- field drift is easy to notice
- ownership/action drift is easier to accidentally rationalize away in UI code

If the maintained proof does not fail here, then the system is weaker exactly where authorization semantics become product-visible.

## Takeaway

This story is the no-go counterpart to the passing `issues` maintained proof.

Together they show:

- when emitted ownership semantics and maintained UI behavior stay aligned, the gate passes
- when the maintained presenter stops respecting owner-only detail actions, the gate should fail immediately and for the correct reason
