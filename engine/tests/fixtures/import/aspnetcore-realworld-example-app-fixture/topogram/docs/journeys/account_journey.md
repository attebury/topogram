---
id: account_journey
kind: journey
title: Account Sign-In and Session Flow
status: inferred
summary: Candidate account journey inferred during reconcile from imported app evidence.
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_account
related_capabilities:
  - cap_sign_in_account
related_workflows:
  - workflow_account
provenance:
  - src/Conduit/Features/Users/UsersController.cs#POST /users/login
tags:
  - import
  - journey
---

Candidate journey inferred during reconcile from imported capabilities, UI surfaces, and workflow evidence.

Review and rewrite this draft before promoting it as canonical.

The user intent centers on signing in and establishing account access cleanly based on the brownfield capabilities, route evidence, and workflow signals recovered for this bundle.

## Happy Path

1. The user through the account API surface and provides the credentials or session input required by `cap_sign_in_account`.
2. The recovered flow returns the user to the authenticated account state without losing the intended next step.
3. The user continues through the remaining account actions while keeping the recovered account lifecycle coherent.

## Alternate Paths

- Workflow evidence such as `workflow_account` should stay aligned with the journey instead of drifting into an undocumented lifecycle.
- If only API evidence exists today, add UI or docs context before promoting this journey as canonical.

## Change Review Notes

Review this journey when changing account capabilities, screen surfaces, route structure, or workflow transitions.
