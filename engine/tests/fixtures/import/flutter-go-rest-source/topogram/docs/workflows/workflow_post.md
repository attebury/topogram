---
id: workflow_post
kind: workflow
title: Post Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_post
related_capabilities:
  - cap_create_post
  - cap_delete_post
  - cap_list_posts
  - cap_update_post
provenance:
  - #10 - Clean Architecture Version (RxDart + Provider)/lib/features/post/data/datasources/post_remote_data_source.dart#createPost
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_post`
States: _none_
Transitions: `cap_create_post` -> `created`, `cap_delete_post` -> `deleted`

Review this workflow before promoting it as canonical.
