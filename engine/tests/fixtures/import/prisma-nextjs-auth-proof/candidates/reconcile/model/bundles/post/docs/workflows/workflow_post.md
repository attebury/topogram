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
  - cap_list_posts
provenance:
  - app/api/posts/route.ts#GET /posts
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_post`
States: _none_
Transitions: `cap_create_post` -> `created`

Review this workflow before promoting it as canonical.
