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
  - cap_create_user
  - cap_register_user
  - cap_sign_in_user
provenance:
  - app/users/new/page.tsx#createUser
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_user`
States: _none_
Transitions: `cap_create_user` -> `created`, `cap_register_user` -> `registered`, `cap_sign_in_user` -> `authenticated`

Review this workflow before promoting it as canonical.
