---
id: article_resubmission_after_review
kind: journey
title: Article Resubmission After Review
status: canonical
summary: An author resubmits an article after review feedback without losing the editorial context of the requested revision.
actors:
  - author
related_actors:
  - actor_author
  - actor_manager
related_roles:
  - role_author
  - role_manager
success_outcome: The author understands the requested revision, updates the article, and returns it to submitted review state.
related_entities:
  - entity_article
related_capabilities:
  - cap_request_article_revision
  - cap_update_article
  - cap_get_article
related_rules:
  - rule_only_active_users_may_review_articles
related_workflows:
  - article_review
related_projections:
  - proj_api
  - proj_ui_shared
  - proj_ui_web
failure_signals:
  - Requested revision feedback is missing when the article returns to the author.
  - The author cannot tell whether the article is still in review or back in drafting.
  - Resubmission requires a different path than updating the article back to submitted.
tags:
  - journey
  - editorial
  - change-review
---

This journey captures the author-facing side of the editorial review loop.

The user intent is not simply to change an article status. The author needs to understand why a revision was requested, make the requested edits, and resubmit the same article back into review without starting over or losing context.

## Happy Path

1. A reviewer requests changes and the article moves to `needs_revision`.
2. The author opens the article and can still see the outstanding review context.
3. The author edits the draft and updates the article with `status=submitted`.
4. The system returns the article to the normal review workflow.

## Alternate Paths

- If review context is no longer visible, the author should still receive enough guidance to understand what changed.
- If the assigned reviewer is no longer active, the article should still remain recoverable within the editorial workflow rather than getting stranded in an ambiguous state.

## Change Review Notes

Review this journey when changing review status semantics, author editing flows, reviewer assignment rules, or the UI copy around revision requests.
