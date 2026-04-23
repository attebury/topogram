---
id: workflow_item
kind: workflow
title: Item Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_item
related_capabilities:
  - cap_create_item
  - cap_get_item
  - cap_list_items
provenance:
  - src/Web/Controllers/ManageController.cs#GET /
  - src/Web/Controllers/OrderController.cs#GET /
  - src/Web/Controllers/UserController.cs#GET /
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_item`
States: _none_
Transitions: `cap_create_item` -> `created`

Review this workflow before promoting it as canonical.
