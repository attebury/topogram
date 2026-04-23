---
id: ui_post_detail
kind: report
title: Post Detail UI Surface
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_post
provenance:
  - app/posts/[id]/page.tsx#/posts/:id
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `post_detail` (detail)
Routes: `/posts/:id`
Actions: `cap_update_post`

Review this UI surface before promoting it into canonical docs or projections.
