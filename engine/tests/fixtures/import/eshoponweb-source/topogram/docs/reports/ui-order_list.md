---
id: ui_order_list
kind: report
title: Order List UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
related_entities:
  - entity_order
provenance:
  - src/Web/Views/Order/MyOrders.cshtml
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `order_list` (list)
Routes: `/order/my-orders`
Actions: `cap_cancel_order`, `cap_get_order`

Review this UI surface before promoting it into canonical docs or projections.
