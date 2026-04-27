---
id: article_review
kind: workflow
title: Article Review Workflow
status: canonical
summary: Editorial review flow from draft to submitted, needs_revision, approved, or rejected.
related_entities:
  - entity_article
related_capabilities:
  - cap_create_article
  - cap_approve_article
  - cap_reject_article
  - cap_request_article_revision
  - cap_update_article
related_projections:
  - proj_api
  - proj_ui_shared
  - proj_ui_web__react
  - proj_ui_web__sveltekit
tags:
  - workflow
  - editorial
---

An article starts in `draft` and becomes `submitted` when an editor sends it for review.

Managers can then make one of three decisions:

- approve the article
- reject the article
- request revision

`needs_revision` is not a terminal state. It means the article remains in editorial workflow, but the author must revise the draft before the article can return to `submitted`.

Resubmission intentionally reuses `cap_update_article` with `status=submitted` rather than introducing a separate resubmit capability. That keeps the workflow compact while still making the revision request explicit in the API and UI.
