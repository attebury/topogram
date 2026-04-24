# Reconcile Report

## Promoted

- None

## Skipped

- `docs/glossary/asp.md`
- `docs/glossary/build.md`
- `docs/glossary/core.md`
- `docs/glossary/net.md`
- `docs/import-report.md`
- `docs/workflows/lifecycle-flow.md`
- `docs/workflows/review-workflow.md`

## Adoption

- Plan: `candidates/reconcile/adoption-plan.json`
- Selector: `journeys`
- Approved items: 0
- Applied items: 62
- Skipped items: 0
- Blocked items: 0
- Canonical files: 6
- Refreshed canonical files: 0
- Approved review groups: 6
- Projection-dependent items: 0
- Projection review groups: 0
- UI review groups: 0
- Workflow review groups: 6

## Approved Review Groups

- `workflow_review:comment`
- `workflow_review:user`
- `workflow_review:account`
- `workflow_review:profile`
- `workflow_review:tag`
- `workflow_review:article`

## Projection Review Groups

- None

## UI Review Groups

- None

## Workflow Review Groups

- `workflow_review:account` <- `dec_account`, `workflow_account`
- `workflow_review:article` <- `dec_article`, `workflow_article`
- `workflow_review:comment` <- `dec_comment`, `workflow_comment`
- `workflow_review:profile` <- `dec_profile`, `workflow_profile`
- `workflow_review:tag` <- `dec_tag`, `workflow_tag`
- `workflow_review:user` <- `dec_user`, `workflow_user`

## Bundle Blockers

- `account`: blocked=0, approved=0, applied=6, pending=0, dependencies=_none_
- `article`: blocked=0, approved=0, applied=20, pending=0, dependencies=_none_
- `comment`: blocked=0, approved=0, applied=9, pending=0, dependencies=_none_
- `profile`: blocked=0, approved=0, applied=9, pending=0, dependencies=_none_
- `tag`: blocked=0, approved=0, applied=6, pending=0, dependencies=_none_
- `user`: blocked=0, approved=0, applied=12, pending=0, dependencies=_none_

## Bundle Priorities

- `article`: next=_none_, bundle-review=_none_, from-plan=no
- `user`: next=_none_, bundle-review=_none_, from-plan=no
- `comment`: next=_none_, bundle-review=_none_, from-plan=no
- `profile`: next=_none_, bundle-review=_none_, from-plan=no
- `tag`: next=_none_, bundle-review=_none_, from-plan=no
- `account`: next=_none_, bundle-review=_none_, from-plan=no

## Suppressed Noise Bundles

- `articlefavorite`: EF Core relationship-link entity inferred as implementation noise.
- `articletag`: EF Core relationship-link entity inferred as implementation noise.
- `followedpeople`: EF Core relationship-link entity inferred as implementation noise.

## Projection Dependencies

- None

## Blocked Adoption Items

- None

## Candidate Model Bundles

- `account` (0 actors, 0 roles, 0 entities, 0 enums, 1 capabilities, 2 shapes, 0 screens, 1 workflows, 1 docs)
- `article` (0 actors, 0 roles, 1 entities, 0 enums, 7 capabilities, 9 shapes, 0 screens, 1 workflows, 1 docs)
- `comment` (0 actors, 0 roles, 1 entities, 0 enums, 2 capabilities, 3 shapes, 0 screens, 1 workflows, 1 docs)
- `profile` (0 actors, 0 roles, 0 entities, 0 enums, 3 capabilities, 3 shapes, 0 screens, 1 workflows, 1 docs)
- `tag` (0 actors, 0 roles, 1 entities, 0 enums, 1 capabilities, 1 shapes, 0 screens, 1 workflows, 1 docs)
- `user` (0 actors, 0 roles, 1 entities, 0 enums, 3 capabilities, 5 shapes, 0 screens, 1 workflows, 1 docs)

## Candidate Model Files

- None

## Canonical Outputs

- `docs/journeys/account_journey.md`
- `docs/journeys/article_journey.md`
- `docs/journeys/comment_journey.md`
- `docs/journeys/profile_journey.md`
- `docs/journeys/tag_journey.md`
- `docs/journeys/user_journey.md`
