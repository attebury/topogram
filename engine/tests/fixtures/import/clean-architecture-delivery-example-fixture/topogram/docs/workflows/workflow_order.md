---
id: workflow_order
kind: workflow
title: Order Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_order
related_capabilities:
  - cap_create_order
  - cap_delete_order
  - cap_delivery_order
  - cap_get_order
  - cap_pay_order
provenance:
  - src/main/java/com/delivery/presenter/rest/api/order/OrderResource.java#POST /Order
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_order`
States: _none_
Transitions: `cap_create_order` -> `created`, `cap_delete_order` -> `deleted`

Review this workflow before promoting it as canonical.
