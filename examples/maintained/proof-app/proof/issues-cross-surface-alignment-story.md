# Issues Cross-Surface Alignment Story

## Goal

Show that Topogram can keep one emitted `issues` semantic change aligned across multiple maintained surfaces inside the same governed output.

This is a maintained-app proof of semantic coherence, not just one presenter field changing in isolation.

## The Change

The `issues` proof now treats owner-or-admin issue management as one cross-surface maintained rule.

That single emitted rule must stay aligned across three maintained surfaces:

- detail action state
- compact list/card summary state
- route and action metadata that still point back to the governed detail surface

In practice, that means the maintained app should keep all of these in agreement:

- detail actions stay owner-or-admin only
- list/card summaries keep the assignee and priority state that explain who should regain those actions in detail
- route and action metadata still describe the same `issue_detail` seam instead of drifting into a separate local interpretation

Relevant maintained file:

- [examples/maintained/proof-app/src/issues.js](../src/issues.js)

Relevant proof gates:

- [examples/maintained/proof-app/scripts/compile-check.mjs](../scripts/compile-check.mjs)
- [examples/maintained/proof-app/scripts/smoke.mjs](../scripts/smoke.mjs)
- [examples/maintained/proof-app/scripts/runtime-check.mjs](../scripts/runtime-check.mjs)

## Seam Summary

- seam family: `issues_cross_surface_alignment`
- output: `maintained_app`
- emitted dependencies:
  - `journey_issue_creation_and_assignment`
  - `journey_issue_resolution_and_closure`
  - `proj_api`
  - `proj_web`
- review class: `review_required`

Maintained surfaces inside this seam family:

- `issues detail action state`
- `issues list/card summary state`
- `issues route and action metadata`

## Why This Matters

This proof is stronger than “the detail screen still renders the right buttons.”

The maintained app can drift in a more subtle way:

- detail actions may still be correct
- but list/card state might stop mirroring the assignee-driven ownership semantics
- or route metadata might stop pointing at the same governed detail seam

That would leave the app locally plausible but semantically incoherent.

This story proves Topogram can keep the maintained app aligned at the seam-family level:

- one emitted semantic rule
- multiple maintained embodiments
- one coherent verification story

## Intentional Drift Example

If a maintainer updates only one of the maintained surfaces, the proof should fail clearly.

Examples:

- detail actions stay owner-or-admin only, but route metadata stops pointing at `issue_detail`
- detail actions stay aligned, but list/card state no longer mirrors the assignee that explains those actions
- list/card and route metadata stay aligned, but detail action visibility stops honoring `assignee_id`

This should not read like three unrelated file findings.
It should read like one cross-surface maintained alignment problem inside the `issues` proof.

## Acceptance

This proof passes when:

1. emitted issue detail visibility still declares owner-or-admin gating
2. emitted issue-list and issue-card surfaces still expose the compact assignee and priority state
3. the maintained detail view model keeps edit and close visibility aligned with assignee-based ownership
4. the maintained list/card state keeps the assignee and priority summary aligned with the same emitted issue seam
5. the maintained route/action metadata for both views still points at the same governed `issue_detail` surface

## Takeaway

Topogram is more useful when it can describe not only whether one maintained file changed, but whether one maintained semantic rule stayed coherent across the surfaces that users actually experience together.
