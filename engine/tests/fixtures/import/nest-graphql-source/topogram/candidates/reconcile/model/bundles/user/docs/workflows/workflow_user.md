---
id: workflow_user
kind: workflow
title: User Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_user
related_capabilities:
  - cap_list_users
  - cap_register_user
provenance:
  - engine/tests/fixtures/import/nest-graphql-source/src/resolvers.user.ts#Mutation.signupUser
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_user`
States: _none_
Transitions: `cap_register_user` -> `registered`

Review this workflow before promoting it as canonical.
