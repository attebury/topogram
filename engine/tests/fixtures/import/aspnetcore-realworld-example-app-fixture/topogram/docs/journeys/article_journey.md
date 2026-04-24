---
id: article_journey
kind: journey
title: Article Creation, Detail, and Lifecycle Flow
status: inferred
summary: Candidate article journey inferred during reconcile from imported app evidence.
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_article
related_capabilities:
  - cap_create_article
  - cap_favorite_article
  - cap_feed_article
  - cap_get_article
  - cap_list_articles
  - cap_unfavorite_article
  - cap_update_article
related_workflows:
  - workflow_article
provenance:
  - src/Conduit/Features/Articles/ArticlesController.cs#GET /articles
  - src/Conduit/Features/Articles/ArticlesController.cs#GET /articles/feed
  - src/Conduit/Features/Articles/ArticlesController.cs#GET /articles/{slug}
  - src/Conduit/Features/Articles/ArticlesController.cs#POST /articles
  - src/Conduit/Features/Articles/ArticlesController.cs#PUT /articles/{slug}
  - src/Conduit/Features/Favorites/FavoritesController.cs#POST /articles/{slug}/favorite
  - src/Conduit/Features/Favorites/FavoritesController.cs#DELETE /articles/{slug}/favorite
  - src/Conduit/Domain/Article.cs
tags:
  - import
  - journey
---

Candidate journey inferred during reconcile from imported capabilities, UI surfaces, and workflow evidence.

Review and rewrite this draft before promoting it as canonical.

The user intent centers on creating article work, finding it again, and moving it through lifecycle changes with confidence based on the brownfield capabilities, route evidence, and workflow signals recovered for this bundle.

## Happy Path

1. The user enters the flow through the article API surface.
2. The recovered flow uses `cap_create_article` to create or submit new article work, then `cap_get_article`, `cap_list_articles` to find it again.
3. The user continues through `cap_update_article` while keeping the recovered article lifecycle coherent.

## Alternate Paths

- Workflow evidence such as `workflow_article` should stay aligned with the journey instead of drifting into an undocumented lifecycle.
- If only API evidence exists today, add UI or docs context before promoting this journey as canonical.

## Change Review Notes

Review this journey when changing article capabilities, screen surfaces, route structure, or workflow transitions.
