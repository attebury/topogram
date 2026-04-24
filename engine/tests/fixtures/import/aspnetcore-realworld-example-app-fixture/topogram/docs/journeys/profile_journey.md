---
id: profile_journey
kind: journey
title: Profile Interaction Flow
status: inferred
summary: Candidate profile journey inferred during reconcile from imported app evidence.
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_profile
related_capabilities:
  - cap_follow_profile
  - cap_get_profile
  - cap_unfollow_profile
related_workflows:
  - workflow_profile
provenance:
  - src/Conduit/Features/Followers/FollowersController.cs#POST /profiles/{username}/follow
  - src/Conduit/Features/Followers/FollowersController.cs#DELETE /profiles/{username}/follow
  - src/Conduit/Features/Profiles/ProfilesController.cs#GET /profiles/{username}
tags:
  - import
  - journey
---

Candidate journey inferred during reconcile from imported capabilities, UI surfaces, and workflow evidence.

Review and rewrite this draft before promoting it as canonical.

The user intent centers on performing repeated profile interactions without losing context based on the brownfield capabilities, route evidence, and workflow signals recovered for this bundle.

## Happy Path

1. The user enters the flow through the profile API surface.
2. The recovered flow uses `cap_get_profile` to load or establish the current profile state.
3. The user can repeat `cap_follow_profile`, `cap_unfollow_profile` while keeping the recovered profile lifecycle coherent.

## Alternate Paths

- Workflow evidence such as `workflow_profile` should stay aligned with the journey instead of drifting into an undocumented lifecycle.
- If only API evidence exists today, add UI or docs context before promoting this journey as canonical.

## Change Review Notes

Review this journey when changing profile capabilities, screen surfaces, route structure, or workflow transitions.
