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
  - cap_get_post
  - cap_list_posts
  - cap_publish_post
  - cap_update_post_view_count
provenance:
  - orm/graphql-sdl-first/src/schema.ts#Query.draftsByUser
  - orm/graphql-sdl-first/src/schema.ts#Query.feed
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_post`
States: _none_
Transitions: `cap_create_post` -> `created`, `cap_delete_post` -> `deleted`, `cap_publish_post` -> `published`

Review this workflow before promoting it as canonical.
