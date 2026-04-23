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
provenance:
  - engine/tests/fixtures/import/nextjs-graphql-source/pages/api/graphql.ts#Query.feed
  - engine/tests/fixtures/import/nextjs-graphql-source/pages/api/graphql.ts#Query.drafts
  - engine/tests/fixtures/import/nextjs-graphql-source/pages/api/graphql.ts#Query.filterPosts
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_post`
States: _none_
Transitions: `cap_create_post` -> `created`, `cap_delete_post` -> `deleted`, `cap_publish_post` -> `published`

Review this workflow before promoting it as canonical.
