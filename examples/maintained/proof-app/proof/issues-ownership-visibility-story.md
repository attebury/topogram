# Issues Ownership Visibility Story

## Goal

Show a maintained-app change that Topogram can support cleanly and safely.

This is the accepted-change counterpart to the existing drift and no-go stories. It demonstrates that Topogram is not only a generator or a stop signal. It can also guide a real maintained app toward the correct visible behavior.

## The Change

The `issues` proof now treats owner-or-admin action visibility as part of the emitted contract surface.

That means the maintained app should mirror these semantics:

- owners can edit and close their issue from detail
- admins can also edit and close
- non-owners should not see owner-only detail actions
- list/card summaries should still reflect the compact emitted issue-card surface

Relevant maintained file:

- [examples/maintained/proof-app/src/issues.js](../src/issues.js)

Relevant proof gates:

- [examples/maintained/proof-app/scripts/compile-check.mjs](../scripts/compile-check.mjs)
- [examples/maintained/proof-app/scripts/smoke.mjs](../scripts/smoke.mjs)
- [examples/maintained/proof-app/scripts/runtime-check.mjs](../scripts/runtime-check.mjs)

## Seam Summary

- seam: `seam_maintained_presenter_structure`
- output: `maintained_app`
- emitted dependencies:
  - `journey_issue_resolution_and_closure`
  - `proj_api`
  - `proj_web`
- review class: `review_required`

## Why This Is A Good Accepted Change

This proof is meaningfully different from the Content Approval story.

It is not primarily about:

- additive DB evolution
- a new workflow action
- route expansion

It is about maintained UI behavior staying aligned with emitted ownership semantics and list/detail surfaces.

That makes it a better proof of the Topogram wedge:

- Topogram can guide a hand-maintained app toward the right behavior
- the app remains hand-maintained
- the proof is attached to emitted semantics, not only to raw model text

## What Topogram Drives vs What Remains Human-Owned

Topogram drives:

- the emitted issue detail and issue-card/list contract surfaces
- the ownership predicate semantics used by the UI contract
- the expectation that owner-or-admin detail actions remain visible only to the right viewer states

The maintained app still owns:

- the exact presenter structure
- naming and composition of the hand-maintained view model
- how the detail view and compact list/card are rendered in maintained code

That is the intended boundary:

- Topogram provides the structural source of truth
- the maintained app chooses how to embody it

## Acceptance

This proof passes when:

1. emitted issue detail visibility still declares owner-or-admin gating
2. emitted issue-card/list surfaces still expose the maintained summary fields
3. the maintained presenter shows edit and close actions for owner or admin
4. the maintained presenter hides owner-only actions for non-owners
5. the maintained list/card summary still mirrors the compact emitted issue surface

## Relationship To The No-Go Story

Read this alongside:

- [issues-ownership-visibility-drift-story.md](./issues-ownership-visibility-drift-story.md)

Together they show the full wedge:

- one maintained change that should be accepted and mirrored
- one maintained drift case that should fail immediately

That “yes” plus “no” pairing is stronger than either proof alone.
