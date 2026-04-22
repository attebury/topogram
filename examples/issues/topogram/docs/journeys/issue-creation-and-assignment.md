---
id: issue_creation_and_assignment
kind: journey
title: Issue Creation And Assignment
status: canonical
summary: A user creates an issue on an active board, assigns it to an active teammate when appropriate, and can immediately find it again in the standard issue views.
actors:
  - user
related_actors:
  - actor_user
success_outcome: The new issue lands on the right board with valid assignment data and is easy to review from the normal list and detail surfaces.
related_entities:
  - entity_issue
  - entity_board
  - entity_user
related_capabilities:
  - cap_create_issue
  - cap_get_issue
  - cap_list_issues
related_rules:
  - rule_no_issue_creation_in_archived_board
  - rule_only_active_users_may_be_assigned_issues
related_projections:
  - proj_api
  - proj_ui_shared
  - proj_ui_web
failure_signals:
  - The user can create an issue in an archived board.
  - The user can assign an issue to an inactive teammate.
  - The new issue is hard to find from the normal issue list or detail flow.
tags:
  - journey
  - issue-tracking
  - assignment
---

This journey captures the most common Issues flow: recording a new problem or work item and assigning clear ownership without losing the board context.

The user intent is not just to persist an issue row. The user needs confidence that the issue belongs to the correct board, respects assignment rules, and shows up immediately in the list and detail surfaces the team uses every day.

## Happy Path

1. The user starts from an active board and opens the new-issue flow.
2. The user enters the issue details, including optional assignee and priority.
3. The system accepts the issue only if the board can still receive work and the assignee remains active.
4. The user can immediately find the new issue in the standard issue list and issue detail views.
5. The team can continue triage by updating the issue as work progresses.

## Alternate Paths

- If the board has already been archived, issue creation should stop before the issue is accepted.
- If the chosen assignee is inactive, the flow should block invalid assignment instead of creating ambiguous ownership.

## Change Review Notes

Review this journey when changing issue creation rules, assignment semantics, archived-board behavior, issue list visibility, or the create/detail issue UI flow.
