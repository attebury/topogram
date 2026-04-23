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
  - cap_get_post
  - cap_list_posts
provenance:
  - src/post/infrastructure/implementations/PostRepository.ts#find
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_post`
States: _none_
Transitions: _none_

Review this workflow before promoting it as canonical.
