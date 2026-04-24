---
id: comment_journey
kind: journey
title: Comment Creation Flow
status: inferred
summary: Candidate comment journey inferred during reconcile from imported app evidence.
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_comment
related_capabilities:
  - cap_create_comment
  - cap_list_comments
related_workflows:
  - workflow_comment
provenance:
  - src/Conduit/Features/Comments/CommentsController.cs#POST /articles/{slug}/comments
  - src/Conduit/Features/Comments/CommentsController.cs#GET /articles/{slug}/comments
  - src/Conduit/Domain/Comment.cs
tags:
  - import
  - journey
---

Candidate journey inferred during reconcile from imported capabilities, UI surfaces, and workflow evidence.

Review and rewrite this draft before promoting it as canonical.

The user intent centers on creating comment work safely based on the brownfield capabilities, route evidence, and workflow signals recovered for this bundle.

## Happy Path

1. The user enters the flow through the comment API surface.
2. The recovered flow uses `cap_list_comments` to load or establish the current comment state.
3. The user continues through `cap_list_comments` while keeping the recovered comment lifecycle coherent.

## Alternate Paths

- Workflow evidence such as `workflow_comment` should stay aligned with the journey instead of drifting into an undocumented lifecycle.
- If only API evidence exists today, add UI or docs context before promoting this journey as canonical.

## Change Review Notes

Review this journey when changing comment capabilities, screen surfaces, route structure, or workflow transitions.
