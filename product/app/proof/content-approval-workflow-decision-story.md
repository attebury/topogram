# Content Approval Workflow Decision Story

## Goal

Show that Topogram can narrow an existing-app change down to the right maintained UI surface without claiming that every workflow decision should be automatic.

## The Ambiguous Change

The `needs_revision` rollout added a new workflow affordance to the Content Approval app:

- reviewers can now request revisions from an article detail view

Topogram can describe that change clearly:

- a new capability exists
- a new route exists
- the detail view now supports a request-revision action

But Topogram does not determine the final product choice for the maintained app:

- should “Request Revision” appear inline or in a menu?
- should it be a warning tone or destructive tone?
- should the page show extra guidance copy before the action?

Those are product and UX decisions, not just structural consequences.

## Seam Summary

- seam: `seam_new_workflow_affordance_treatment`
- output: `maintained_app`
- emitted dependencies:
  - `journey_editorial_review_and_revision`
  - `proj_web`
- review class: `manual_decision`

## Maintained-App Guard

The maintained proof app now models that boundary in:

- [src/content-approval-change-guards.js](/Users/attebury/Documents/topogram/product/app/src/content-approval-change-guards.js)

That guard treats a newly added workflow affordance as:

- identifiable from Topogram-informed surface changes
- not safe to auto-apply without a human decision

In practice, the proof now distinguishes:

- stable workflow surface
  - safe for guided edits
- newly added request-revision affordance
  - `manualDecisionRequired = true`

## Why This Matters

This is a stronger maintained-app proof than simple field propagation.

It shows that Topogram can help an agent answer:

- what changed?
- which maintained code surface is impacted?
- where should we stop and ask for product judgment?

That is closer to the real thesis than “generate a page” or even “patch a route.”

## Verification

The maintained proof checks now cover this decision boundary:

- `cd /Users/attebury/Documents/topogram/product/app && node ./scripts/compile-check.mjs`
- `cd /Users/attebury/Documents/topogram/product/app && node ./scripts/smoke.mjs`
- `cd /Users/attebury/Documents/topogram/product/app && node ./scripts/runtime-check.mjs`

Those assertions prove that the maintained app:

- accepts stable workflow surfaces as guideable
- marks new workflow affordances as manual-decision cases

## Takeaway

Topogram’s value is not just that it can automate changes.

It is also that it can tell an agent:

- which part of the maintained app is affected
- which part is structurally safe
- and which part still needs a human product decision
