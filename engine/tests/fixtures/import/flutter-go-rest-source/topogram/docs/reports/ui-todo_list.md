---
id: ui_todo_list
kind: report
title: Todo List UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
related_entities:
  - entity_todo
provenance:
  - #10 - Clean Architecture Version (RxDart + Provider)/lib/features/todo/presentation/screens/todo_list_screen.dart#ToDoListScreen
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `todo_list` (list)
Routes: `/todos`
Actions: `cap_create_todo`, `cap_delete_todo`, `cap_list_todos`, `cap_update_todo`

Review this UI surface before promoting it into canonical docs or projections.
