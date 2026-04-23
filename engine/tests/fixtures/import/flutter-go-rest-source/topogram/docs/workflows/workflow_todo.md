---
id: workflow_todo
kind: workflow
title: Todo Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_todo
related_capabilities:
  - cap_create_todo
  - cap_delete_todo
  - cap_list_todos
  - cap_update_todo
provenance:
  - #10 - Clean Architecture Version (RxDart + Provider)/lib/features/todo/data/datasources/todo_remote_data_source.dart#createTodo
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_todo`
States: _none_
Transitions: `cap_create_todo` -> `created`, `cap_delete_todo` -> `deleted`

Review this workflow before promoting it as canonical.
