---
id: ui_user_list
kind: report
title: User List UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
related_entities:
  - entity_user
provenance:
  - #10 - Clean Architecture Version (RxDart + Provider)/lib/features/user/presentation/screens/user_list_screen.dart#UserListScreen
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `user_list` (list)
Routes: `/users`
Actions: `cap_create_user`, `cap_delete_user`, `cap_list_users`, `cap_update_user`

Review this UI surface before promoting it into canonical docs or projections.
