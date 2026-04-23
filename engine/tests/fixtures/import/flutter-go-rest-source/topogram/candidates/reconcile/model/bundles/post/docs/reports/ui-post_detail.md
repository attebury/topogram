---
id: ui_post_detail
kind: report
title: Post Detail UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
related_entities:
  - entity_post
provenance:
  - #10 - Clean Architecture Version (RxDart + Provider)/lib/features/post/presentation/screens/post_detail_screen.dart#PostDetailScreen
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `post_detail` (detail)
Routes: `/posts/:id`
Actions: `cap_create_post`, `cap_delete_post`, `cap_list_posts`, `cap_update_post`

Review this UI surface before promoting it into canonical docs or projections.
