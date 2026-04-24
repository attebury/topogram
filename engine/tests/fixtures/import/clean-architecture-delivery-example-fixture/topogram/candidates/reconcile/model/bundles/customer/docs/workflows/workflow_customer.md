---
id: workflow_customer
kind: workflow
title: Customer Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_customer
related_capabilities:
  - cap_create_customer
  - cap_get_customer
provenance:
  - src/main/java/com/delivery/presenter/rest/api/customer/CustomerResource.java#POST /Customer
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_customer`
States: _none_
Transitions: `cap_create_customer` -> `created`

Review this workflow before promoting it as canonical.
