---
id: member
kind: glossary
title: Member
status: canonical
summary: Workspace member who can own collections and be assigned items.
aliases:
  - owner
  - assignee
related_entities:
  - entity_member
related_capabilities:
  - cap_create_member
  - cap_update_member
tags:
  - naming
  - identity
---

A member is a workspace member who can be assigned items and may own collections.

Legacy product language sometimes says "owner" for both item assignment and collection ownership, but the canonical Topogram term is `member`. The item and collection models keep `owner_id` as the relationship field name because that reflects current product semantics, while the resource itself remains `entity_member`.
