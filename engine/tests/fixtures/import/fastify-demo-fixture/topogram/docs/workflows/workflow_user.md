---
id: workflow_user
kind: workflow
title: User Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_user
related_capabilities:
  - cap_update_user
provenance:
  - src/routes/api/users/index.ts#PUT /users/update-password
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_user`
States: _none_
Transitions: _none_

Review this workflow before promoting it as canonical.
