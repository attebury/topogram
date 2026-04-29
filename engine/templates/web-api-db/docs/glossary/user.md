---
id: user
kind: glossary
title: User
status: canonical
summary: Workspace member who can own projects and be assigned tasks.
aliases:
  - owner
  - assignee
related_entities:
  - entity_user
related_capabilities:
  - cap_create_user
  - cap_update_user
tags:
  - naming
  - identity
---

A user is a workspace member who can be assigned tasks and may own projects.

Legacy product language sometimes says "owner" for both task assignment and project ownership, but the canonical Topogram term is `user`. The task and project models keep `owner_id` as the relationship field name because that reflects current product semantics, while the resource itself remains `entity_user`.
