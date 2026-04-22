# Maintained Contract Review

## Purpose

This is an evaluator-facing, hand-written review artifact for the maintained-app proof package.

Its job is to provide one trust layer outside the generated verification loop:

- a human can read emitted Topogram artifacts
- a human can inspect the maintained app surfaces
- a human can confirm whether the maintained app still mirrors the emitted contract boundary

This is not a replacement for compile, smoke, or runtime-check gates.
It is an independent review aid that makes the maintained proof easier to audit directly.

## Review Questions

Use this review when evaluating a maintained-app change story.

1. What emitted artifact is the source of truth for this proof?
2. Which maintained file mirrors that emitted surface?
3. Which parts of the change are structurally safe to mirror?
4. Which parts still require human product or migration judgment?
5. What is the explicit no-go case for this proof?

## Current Review Targets

### Issues ownership visibility

Emitted evidence:

- emitted UI visibility for `issue_detail`
- emitted compact `issue_card` / list surface
- emitted journey expectations for issue resolution and closure

Maintained surface:

- [product/app/src/issues.js](/Users/attebury/Documents/topogram/product/app/src/issues.js)

Reviewer should confirm:

- owner-or-admin action visibility is still mirrored in the maintained presenter
- non-owner hidden states still exist
- compact list/card output still mirrors the emitted issue-card shape

### Content Approval workflow decision boundary

Emitted evidence:

- request-revision action exists in the emitted workflow/UI surface

Maintained surface:

- [product/app/src/content-approval-change-guards.js](/Users/attebury/Documents/topogram/product/app/src/content-approval-change-guards.js)

Reviewer should confirm:

- newly added workflow affordances are still surfaced as manual-decision cases
- the maintained app does not pretend the final UI treatment is fully generator-owned

### Todo project owner unsupported change

Emitted evidence:

- emitted ownership relation semantics for project owner

Maintained surface:

- [product/app/src/todo-change-guards.js](/Users/attebury/Documents/topogram/product/app/src/todo-change-guards.js)

Reviewer should confirm:

- ownership retargeting is still treated as a manual-decision boundary
- the maintained app does not silently accept a foreign-key meaning change as routine

## How To Use This Artifact

For a skeptical evaluator, the intended flow is:

1. read the maintained-app proof story
2. inspect the emitted artifact referenced by that story
3. inspect the maintained file named in the story
4. use this review page to confirm the structural boundary in plain language

That gives Topogram one explicit trust anchor that is not only “run the generated checks and trust the output.”
