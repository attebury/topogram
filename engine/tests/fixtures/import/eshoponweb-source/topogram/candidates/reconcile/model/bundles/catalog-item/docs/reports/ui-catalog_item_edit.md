---
id: ui_catalog_item_edit
kind: report
title: Catalog Item Edit UI Surface
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_catalog-item
provenance:
  - src/BlazorAdmin/Pages/CatalogItemPage/Edit.razor
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `catalog_item_edit` (form)
Routes: `/admin/catalog-items/:id/edit`
Actions: `cap_get_catalog_item`, `cap_update_catalog_item`

Review this UI surface before promoting it into canonical docs or projections.
