---
id: workflow_product
kind: workflow
title: Product Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_product
related_capabilities:
  - cap_get_product
  - cap_list_products
  - cap_search_products
provenance:
  - src/main/java/com/delivery/presenter/rest/api/product/ProductResource.java#GET /Product
  - src/main/java/com/delivery/presenter/rest/api/store/StoreResource.java#GET /Store/{id}/products
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_product`
States: _none_
Transitions: _none_

Review this workflow before promoting it as canonical.
