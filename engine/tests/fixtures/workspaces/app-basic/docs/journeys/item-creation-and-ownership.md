---
id: item_creation_and_ownership
kind: journey
title: Item Creation And Ownership
status: canonical
summary: A member creates a item in an active collection, assigns clear ownership, and can immediately find it again to keep work moving.
actors:
  - member
related_actors:
  - actor_member
success_outcome: The new item is captured in the right collection with valid ownership and remains easy to review and update.
related_entities:
  - entity_item
  - entity_collection
  - entity_member
related_capabilities:
  - cap_create_item
  - cap_get_item
  - cap_list_items
  - cap_update_item
related_rules:
  - rule_no_item_creation_in_archived_collection
  - rule_only_active_members_may_own_items
related_projections:
  - proj_api
  - proj_ui_shared
  - proj_ui_web
failure_signals:
  - The member can create a item in an archived collection.
  - The member can assign a item to an inactive owner.
  - The newly created item is hard to find from the normal item list or detail flow.
tags:
  - journey
  - item-management
  - ownership
---

This journey captures the most common sample-workspace flow: turning a piece of
work into a tracked item with clear ownership.

The member intent is not just to persist a row. The member needs confidence that the item belongs to the correct collection, follows ownership rules, and shows up immediately in the standard list and detail views used to manage work.

## Happy Path

1. The member starts from an active collection and opens the new-item flow.
2. The member enters the item details, including priority and an optional owner.
3. The system accepts the item only if the collection can still receive new work and the owner is active.
4. The member can immediately find the new item in item list and item detail surfaces.
5. The member can keep the flow moving by updating the item as work progresses.

## Alternate Paths

- If the collection has already been archived, item creation should stop before the new item is accepted.
- If the chosen owner is inactive, the flow should block invalid assignment instead of creating ambiguous accountability.

## Change Review Notes

Review this journey when changing item creation rules, ownership semantics, collection archival behavior, item list visibility, or the create/update item UI flow.
