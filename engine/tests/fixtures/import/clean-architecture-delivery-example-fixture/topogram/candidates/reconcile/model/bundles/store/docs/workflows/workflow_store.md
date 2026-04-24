---
id: workflow_store
kind: workflow
title: Store Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_store
related_capabilities:
  - cap_get_store
  - cap_list_stores
  - cap_search_stores
provenance:
  - src/main/java/com/delivery/presenter/rest/api/cousine/CousineResource.java#GET /Cousine/{id}/stores
  - src/main/java/com/delivery/presenter/rest/api/store/StoreResource.java#GET /Store
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_store`
States: _none_
Transitions: _none_

Review this workflow before promoting it as canonical.
