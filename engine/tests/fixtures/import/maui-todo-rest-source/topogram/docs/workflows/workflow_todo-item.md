---
id: workflow_todo-item
kind: workflow
title: Todo Item Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_todo-item
related_capabilities:
  - cap_create_todo_item
  - cap_delete_todo_item
  - cap_list_todo_items
  - cap_update_todo_item
provenance:
  - 10.0/WebServices/TodoREST/TodoAPI/Controllers/TodoItemsController.cs#GET /
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_todo-item`
States: _none_
Transitions: `cap_create_todo_item` -> `created`, `cap_delete_todo_item` -> `deleted`

Review this workflow before promoting it as canonical.
