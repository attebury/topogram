---
id: ui_catalog_item_delete
kind: report
title: Catalog Item Delete UI Surface
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_catalog-item
provenance:
  - src/BlazorAdmin/Pages/CatalogItemPage/Delete.razor
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `catalog_item_delete` (form)
Routes: `/admin/catalog-items/:id/delete`
Actions: `cap_delete_catalog_item`, `cap_get_catalog_item`

Review this UI surface before promoting it into canonical docs or projections.
