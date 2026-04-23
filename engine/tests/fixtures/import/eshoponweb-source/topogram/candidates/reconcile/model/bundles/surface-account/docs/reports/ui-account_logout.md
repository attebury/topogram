---
id: ui_account_logout
kind: report
title: Account Logout UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
provenance:
  - src/BlazorAdmin/Pages/Logout.razor
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `account_logout` (auth)
Routes: `/logout`
Actions: `cap_sign_out_account`

Review this UI surface before promoting it into canonical docs or projections.
