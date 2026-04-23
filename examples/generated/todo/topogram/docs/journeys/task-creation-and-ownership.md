---
id: task_creation_and_ownership
kind: journey
title: Task Creation And Ownership
status: canonical
summary: A user creates a task in an active project, assigns clear ownership, and can immediately find it again to keep work moving.
actors:
  - user
related_actors:
  - actor_user
success_outcome: The new task is captured in the right project with valid ownership and remains easy to review and update.
related_entities:
  - entity_task
  - entity_project
  - entity_user
related_capabilities:
  - cap_create_task
  - cap_get_task
  - cap_list_tasks
  - cap_update_task
related_rules:
  - rule_no_task_creation_in_archived_project
  - rule_only_active_users_may_own_tasks
related_projections:
  - proj_api
  - proj_ui_shared
  - proj_ui_web
failure_signals:
  - The user can create a task in an archived project.
  - The user can assign a task to an inactive owner.
  - The newly created task is hard to find from the normal task list or detail flow.
tags:
  - journey
  - task-management
  - ownership
---

This journey captures the most common Todo flow: turning a piece of work into a tracked task with clear ownership.

The user intent is not just to persist a row. The user needs confidence that the task belongs to the correct project, follows ownership rules, and shows up immediately in the standard list and detail views used to manage work.

## Happy Path

1. The user starts from an active project and opens the new-task flow.
2. The user enters the task details, including priority and an optional owner.
3. The system accepts the task only if the project can still receive new work and the owner is active.
4. The user can immediately find the new task in task list and task detail surfaces.
5. The user can keep the flow moving by updating the task as work progresses.

## Alternate Paths

- If the project has already been archived, task creation should stop before the new task is accepted.
- If the chosen owner is inactive, the flow should block invalid assignment instead of creating ambiguous accountability.

## Change Review Notes

Review this journey when changing task creation rules, ownership semantics, project archival behavior, task list visibility, or the create/update task UI flow.
