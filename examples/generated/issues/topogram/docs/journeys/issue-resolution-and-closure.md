---
id: issue_resolution_and_closure
kind: journey
title: Issue Resolution And Closure
status: canonical
summary: An assigned user reviews an issue in detail, updates it as work progresses, and closes it without losing ownership or lifecycle clarity.
actors:
  - user
related_actors:
  - actor_user
success_outcome: The issue moves through active work and closure with clear assignee ownership, visible detail context, and an auditable closed state.
related_entities:
  - entity_issue
  - entity_user
related_capabilities:
  - cap_get_issue
  - cap_update_issue
  - cap_close_issue
related_rules:
  - rule_only_active_users_may_be_assigned_issues
related_projections:
  - proj_api
  - proj_ui_shared
  - proj_ui_web__react
  - proj_ui_web__sveltekit
failure_signals:
  - A non-owner can update or close the issue from the normal detail flow.
  - The assignee cannot tell whether the issue is still active or already closed.
  - Closing the issue loses important lifecycle context such as who owned it or when it closed.
tags:
  - journey
  - issue-tracking
  - ownership
  - lifecycle
---

This journey captures the day-to-day resolution flow for an assigned issue.

The user intent is not only to flip a status field. The assignee needs to understand the current issue state, make progress updates safely, and close the issue in a way that preserves ownership and lifecycle clarity for the rest of the team.

## Happy Path

1. The assignee opens the issue detail view and confirms the current board, priority, and ownership context.
2. The assignee updates the issue as work progresses, including status or assignment changes when needed.
3. The assignee closes the issue once the work is complete.
4. The system records the closed lifecycle state without losing the detail context that explains what happened.

## Alternate Paths

- If the current user is not the issue owner, the normal detail flow should not present owner-only update or close actions as if they were allowed.
- If assignment changes are needed before closure, the workflow should keep assignment rules explicit instead of letting an inactive user remain the effective owner.

## Change Review Notes

Review this journey when changing issue detail actions, ownership semantics, assignment visibility, close-issue behavior, or status lifecycle expectations.
