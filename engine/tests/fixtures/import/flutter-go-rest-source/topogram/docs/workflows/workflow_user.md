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
  - cap_delete_user
  - cap_list_users
  - cap_update_user
provenance:
  - #10 - Clean Architecture Version (RxDart + Provider)/lib/features/user/data/datasources/user_remote_data_source.dart#createUser
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_user`
States: _none_
Transitions: `cap_create_user` -> `created`, `cap_delete_user` -> `deleted`

Review this workflow before promoting it as canonical.
