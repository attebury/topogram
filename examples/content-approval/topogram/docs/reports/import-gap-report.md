---
id: import_gap_report
kind: report
title: Content Approval Import Gap Report
status: inferred
summary: Example brownfield-style report showing what still requires review after workflow import.
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_article
related_capabilities:
  - cap_request_article_revision
  - cap_update_article
related_docs:
  - article_review
provenance:
  - examples/content-approval/topogram/projections/proj-api.tg
  - examples/content-approval/topogram/projections/proj-ui-shared.tg
  - examples/content-approval/topogram/projections/proj-ui-web.tg
tags:
  - import
  - brownfield
---

This report models the kind of uncertainty an import agent should surface instead of flattening it into fake certainty.

Open questions that would still merit review in a brownfield import:

- Should "Request Revision" be presented as a warning action or a destructive action in the maintained UI?
- Should reviewer notes remain visible to authors after resubmission, or be treated as historical review records?
- Is `needs_revision` closer to a review decision or an editorial status in team language?

The underlying workflow is implemented clearly enough to support generation and runtime checks, but these presentation and naming decisions still benefit from human review.
