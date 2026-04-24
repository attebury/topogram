---
id: workflow_status
kind: workflow
title: Status Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_status
related_capabilities:
  - cap_delete_status
  - cap_get_task
  - cap_update_status_status
  - cap_update_task_status
provenance:
  - src/main/java/com/example/interfaces/task/TaskResource.java#GET /status
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_status`
States: _none_
Transitions: `cap_delete_status` -> `deleted`

Review this workflow before promoting it as canonical.
