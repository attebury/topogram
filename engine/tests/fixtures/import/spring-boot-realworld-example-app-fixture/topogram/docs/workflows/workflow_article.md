---
id: workflow_article
kind: workflow
title: Article Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_article
related_capabilities:
  - cap_create_article
  - cap_delete_article
  - cap_favorite_article
  - cap_feed_article
  - cap_get_article
  - cap_list_articles
  - cap_unfavorite_article
  - cap_update_article
provenance:
  - src/main/java/io/spring/api/ArticleApi.java#GET /articles/{slug}
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_article`
States: _none_
Transitions: `cap_create_article` -> `created`, `cap_delete_article` -> `deleted`

Review this workflow before promoting it as canonical.
