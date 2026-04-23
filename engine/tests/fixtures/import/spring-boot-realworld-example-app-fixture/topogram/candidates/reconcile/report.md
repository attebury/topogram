# Reconcile Report

## Promoted

- None

## Skipped

- None

## Adoption

- Plan: `candidates/reconcile/adoption-plan.json`
- Selector: `none`
- Approved items: 0
- Applied items: 54
- Skipped items: 0
- Blocked items: 0
- Canonical files: 0
- Refreshed canonical files: 0
- Approved review groups: 6
- Projection-dependent items: 0
- Projection review groups: 0
- UI review groups: 0
- Workflow review groups: 6

## Approved Review Groups

- `workflow_review:article`
- `workflow_review:comment`
- `workflow_review:user`
- `workflow_review:profile`
- `workflow_review:tag`
- `workflow_review:account`

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

- `account`: blocked=0, approved=0, applied=5, pending=0, dependencies=_none_
- `article`: blocked=0, approved=0, applied=17, pending=0, dependencies=_none_
- `comment`: blocked=0, approved=0, applied=10, pending=0, dependencies=_none_
- `profile`: blocked=0, approved=0, applied=7, pending=0, dependencies=_none_
- `tag`: blocked=0, approved=0, applied=5, pending=0, dependencies=_none_
- `user`: blocked=0, approved=0, applied=10, pending=0, dependencies=_none_

## Bundle Priorities

- `article`: next=_none_, bundle-review=_none_, from-plan=no
- `comment`: next=_none_, bundle-review=_none_, from-plan=no
- `user`: next=_none_, bundle-review=_none_, from-plan=no
- `profile`: next=_none_, bundle-review=_none_, from-plan=no
- `tag`: next=_none_, bundle-review=_none_, from-plan=no
- `account`: next=_none_, bundle-review=_none_, from-plan=no

## Suppressed Noise Bundles

- `article-favorite`: Spring MyBatis implementation-noise join table for article favorites.
- `follow`: Spring MyBatis implementation-noise join table for follow relationships.
- `article-tag`: Spring MyBatis implementation-noise join table for article-tag linkage.

## Projection Dependencies

- None

## Blocked Adoption Items

- None

## Candidate Model Bundles

- `account` (0 actors, 0 roles, 0 entities, 0 enums, 1 capabilities, 2 shapes, 0 screens, 1 workflows, 0 docs)
- `article` (0 actors, 0 roles, 1 entities, 0 enums, 8 capabilities, 6 shapes, 0 screens, 1 workflows, 0 docs)
- `comment` (0 actors, 0 roles, 1 entities, 0 enums, 3 capabilities, 4 shapes, 0 screens, 1 workflows, 0 docs)
- `profile` (0 actors, 0 roles, 0 entities, 0 enums, 3 capabilities, 2 shapes, 0 screens, 1 workflows, 0 docs)
- `tag` (0 actors, 0 roles, 1 entities, 0 enums, 1 capabilities, 1 shapes, 0 screens, 1 workflows, 0 docs)
- `user` (0 actors, 0 roles, 1 entities, 0 enums, 3 capabilities, 4 shapes, 0 screens, 1 workflows, 0 docs)

## Candidate Model Files

- `candidates/reconcile/model/bundles/account/README.md`
- `candidates/reconcile/model/bundles/account/capabilities/cap_sign_in_account.tg`
- `candidates/reconcile/model/bundles/account/decisions/dec_account.tg`
- `candidates/reconcile/model/bundles/account/docs/workflows/workflow_account.md`
- `candidates/reconcile/model/bundles/account/shapes/shape_input_sign_in_account.tg`
- `candidates/reconcile/model/bundles/account/shapes/shape_output_sign_in_account.tg`
- `candidates/reconcile/model/bundles/article/README.md`
- `candidates/reconcile/model/bundles/article/capabilities/cap_create_article.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_delete_article.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_favorite_article.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_feed_article.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_get_article.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_list_articles.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_unfavorite_article.tg`
- `candidates/reconcile/model/bundles/article/capabilities/cap_update_article.tg`
- `candidates/reconcile/model/bundles/article/decisions/dec_article.tg`
- `candidates/reconcile/model/bundles/article/docs/workflows/workflow_article.md`
- `candidates/reconcile/model/bundles/article/entities/entity_article.tg`
- `candidates/reconcile/model/bundles/article/shapes/shape_input_create_article.tg`
- `candidates/reconcile/model/bundles/article/shapes/shape_output_create_article.tg`
- `candidates/reconcile/model/bundles/article/shapes/shape_output_delete_article.tg`
- `candidates/reconcile/model/bundles/article/shapes/shape_output_favorite_article.tg`
- `candidates/reconcile/model/bundles/article/shapes/shape_output_unfavorite_article.tg`
- `candidates/reconcile/model/bundles/article/shapes/shape_output_update_article.tg`
- `candidates/reconcile/model/bundles/comment/README.md`
- `candidates/reconcile/model/bundles/comment/capabilities/cap_create_comment.tg`
- `candidates/reconcile/model/bundles/comment/capabilities/cap_delete_comment.tg`
- `candidates/reconcile/model/bundles/comment/capabilities/cap_list_comments.tg`
- `candidates/reconcile/model/bundles/comment/decisions/dec_comment.tg`
- `candidates/reconcile/model/bundles/comment/docs/workflows/workflow_comment.md`
- `candidates/reconcile/model/bundles/comment/entities/entity_comment.tg`
- `candidates/reconcile/model/bundles/comment/shapes/shape_input_create_comment.tg`
- `candidates/reconcile/model/bundles/comment/shapes/shape_output_create_comment.tg`
- `candidates/reconcile/model/bundles/comment/shapes/shape_output_delete_comment.tg`
- `candidates/reconcile/model/bundles/comment/shapes/shape_output_list_comments.tg`
- `candidates/reconcile/model/bundles/profile/README.md`
- `candidates/reconcile/model/bundles/profile/capabilities/cap_follow_profile.tg`
- `candidates/reconcile/model/bundles/profile/capabilities/cap_get_profile.tg`
- `candidates/reconcile/model/bundles/profile/capabilities/cap_unfollow_profile.tg`
- `candidates/reconcile/model/bundles/profile/decisions/dec_profile.tg`
- `candidates/reconcile/model/bundles/profile/docs/workflows/workflow_profile.md`
- `candidates/reconcile/model/bundles/profile/shapes/shape_output_follow_profile.tg`
- `candidates/reconcile/model/bundles/profile/shapes/shape_output_unfollow_profile.tg`
- `candidates/reconcile/model/bundles/tag/README.md`
- `candidates/reconcile/model/bundles/tag/capabilities/cap_list_tags.tg`
- `candidates/reconcile/model/bundles/tag/decisions/dec_tag.tg`
- `candidates/reconcile/model/bundles/tag/docs/workflows/workflow_tag.md`
- `candidates/reconcile/model/bundles/tag/entities/entity_tag.tg`
- `candidates/reconcile/model/bundles/tag/shapes/shape_output_list_tags.tg`
- `candidates/reconcile/model/bundles/user/README.md`
- `candidates/reconcile/model/bundles/user/capabilities/cap_create_user.tg`
- `candidates/reconcile/model/bundles/user/capabilities/cap_get_user.tg`
- `candidates/reconcile/model/bundles/user/capabilities/cap_update_user.tg`
- `candidates/reconcile/model/bundles/user/decisions/dec_user.tg`
- `candidates/reconcile/model/bundles/user/docs/workflows/workflow_user.md`
- `candidates/reconcile/model/bundles/user/entities/entity_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_input_create_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_output_create_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_output_get_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_output_update_user.tg`

## Canonical Outputs

- None
