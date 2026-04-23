---
id: ui_catalog_item_detail
kind: report
title: Catalog Item Detail UI Surface
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_catalog-item
provenance:
  - src/BlazorAdmin/Pages/CatalogItemPage/Details.razor
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `catalog_item_detail` (detail)
Routes: `/admin/catalog-items/:id`
Actions: `cap_get_catalog_item`

Review this UI surface before promoting it into canonical docs or projections.
