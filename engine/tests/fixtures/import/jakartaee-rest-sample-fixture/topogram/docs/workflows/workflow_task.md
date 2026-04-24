---
id: workflow_task
kind: workflow
title: Task Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_task
related_capabilities:
  - cap_create_task
  - cap_delete_task
  - cap_get_task
  - cap_list_tasks
  - cap_update_task
  - cap_update_task_status
provenance:
  - src/main/java/com/example/interfaces/task/TaskResource.java#GET /tasks/{id}
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_task`
States: _none_
Transitions: `cap_create_task` -> `created`, `cap_delete_task` -> `deleted`

Review this workflow before promoting it as canonical.
