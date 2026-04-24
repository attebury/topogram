---
id: workflow_account
kind: workflow
title: Account Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_account
related_capabilities:
  - cap_sign_in_account
provenance:
  - src/routes/api/auth/index.ts#POST /auth/login
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_account`
States: _none_
Transitions: `cap_sign_in_account` -> `authenticated`

Review this workflow before promoting it as canonical.
