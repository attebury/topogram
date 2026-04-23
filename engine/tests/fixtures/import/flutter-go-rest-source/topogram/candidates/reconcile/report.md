# Reconcile Report

## Promoted

- None

## Skipped

- None

## Adoption

- Plan: `candidates/reconcile/adoption-plan.json`
- Selector: `none`
- Approved items: 0
- Applied items: 46
- Skipped items: 0
- Blocked items: 0
- Canonical files: 0
- Refreshed canonical files: 0
- Approved review groups: 4
- Projection-dependent items: 0
- Projection review groups: 0
- UI review groups: 0
- Workflow review groups: 4

## Approved Review Groups

- `workflow_review:post`
- `workflow_review:todo`
- `workflow_review:user`
- `workflow_review:comment`

## Projection Review Groups

- None

## UI Review Groups

- None

## Workflow Review Groups

- `workflow_review:comment` <- `dec_comment`, `workflow_comment`
- `workflow_review:post` <- `dec_post`, `workflow_post`
- `workflow_review:todo` <- `dec_todo`, `workflow_todo`
- `workflow_review:user` <- `dec_user`, `workflow_user`

## Bundle Blockers

- `comment`: blocked=0, approved=0, applied=8, pending=0, dependencies=_none_
- `enum-todo-todo-status`: blocked=0, approved=0, applied=1, pending=0, dependencies=_none_
- `enum-user-gender`: blocked=0, approved=0, applied=1, pending=0, dependencies=_none_
- `enum-user-user-status`: blocked=0, approved=0, applied=1, pending=0, dependencies=_none_
- `post`: blocked=0, approved=0, applied=13, pending=0, dependencies=_none_
- `todo`: blocked=0, approved=0, applied=11, pending=0, dependencies=_none_
- `user`: blocked=0, approved=0, applied=11, pending=0, dependencies=_none_

## Bundle Priorities

- `post`: next=_none_, bundle-review=_none_, from-plan=no
- `todo`: next=_none_, bundle-review=_none_, from-plan=no
- `user`: next=_none_, bundle-review=_none_, from-plan=no
- `comment`: next=_none_, bundle-review=_none_, from-plan=no
- `enum-todo-todo-status`: next=_none_, bundle-review=_none_, from-plan=no
- `enum-user-gender`: next=_none_, bundle-review=_none_, from-plan=no
- `enum-user-user-status`: next=_none_, bundle-review=_none_, from-plan=no

## Suppressed Noise Bundles

- None

## Projection Dependencies

- None

## Blocked Adoption Items

- None

## Candidate Model Bundles

- `comment` (1 entities, 0 enums, 3 capabilities, 2 shapes, 0 screens, 1 workflows, 0 docs)
- `enum-todo-todo-status` (0 entities, 1 enums, 0 capabilities, 0 shapes, 0 screens, 0 workflows, 0 docs)
- `enum-user-gender` (0 entities, 1 enums, 0 capabilities, 0 shapes, 0 screens, 0 workflows, 0 docs)
- `enum-user-user-status` (0 entities, 1 enums, 0 capabilities, 0 shapes, 0 screens, 0 workflows, 0 docs)
- `post` (1 entities, 0 enums, 4 capabilities, 3 shapes, 3 screens, 1 workflows, 0 docs)
- `todo` (1 entities, 0 enums, 4 capabilities, 3 shapes, 1 screens, 1 workflows, 0 docs)
- `user` (1 entities, 0 enums, 4 capabilities, 3 shapes, 1 screens, 1 workflows, 0 docs)

## Candidate Model Files

- `candidates/reconcile/model/bundles/comment/README.md`
- `candidates/reconcile/model/bundles/comment/capabilities/cap_create_comment.tg`
- `candidates/reconcile/model/bundles/comment/capabilities/cap_delete_comment.tg`
- `candidates/reconcile/model/bundles/comment/capabilities/cap_list_comments.tg`
- `candidates/reconcile/model/bundles/comment/decisions/dec_comment.tg`
- `candidates/reconcile/model/bundles/comment/docs/workflows/workflow_comment.md`
- `candidates/reconcile/model/bundles/comment/entities/entity_comment.tg`
- `candidates/reconcile/model/bundles/comment/shapes/shape_input_create_comment.tg`
- `candidates/reconcile/model/bundles/comment/shapes/shape_output_list_comments.tg`
- `candidates/reconcile/model/bundles/enum-todo-todo-status/README.md`
- `candidates/reconcile/model/bundles/enum-todo-todo-status/enums/enum_todo_todo-status.tg`
- `candidates/reconcile/model/bundles/enum-user-gender/README.md`
- `candidates/reconcile/model/bundles/enum-user-gender/enums/enum_user_gender.tg`
- `candidates/reconcile/model/bundles/enum-user-user-status/README.md`
- `candidates/reconcile/model/bundles/enum-user-user-status/enums/enum_user_user-status.tg`
- `candidates/reconcile/model/bundles/post/README.md`
- `candidates/reconcile/model/bundles/post/capabilities/cap_create_post.tg`
- `candidates/reconcile/model/bundles/post/capabilities/cap_delete_post.tg`
- `candidates/reconcile/model/bundles/post/capabilities/cap_list_posts.tg`
- `candidates/reconcile/model/bundles/post/capabilities/cap_update_post.tg`
- `candidates/reconcile/model/bundles/post/decisions/dec_post.tg`
- `candidates/reconcile/model/bundles/post/docs/reports/ui-create_post.md`
- `candidates/reconcile/model/bundles/post/docs/reports/ui-post_detail.md`
- `candidates/reconcile/model/bundles/post/docs/reports/ui-post_list.md`
- `candidates/reconcile/model/bundles/post/docs/workflows/workflow_post.md`
- `candidates/reconcile/model/bundles/post/entities/entity_post.tg`
- `candidates/reconcile/model/bundles/post/shapes/shape_input_create_post.tg`
- `candidates/reconcile/model/bundles/post/shapes/shape_input_update_post.tg`
- `candidates/reconcile/model/bundles/post/shapes/shape_output_list_posts.tg`
- `candidates/reconcile/model/bundles/todo/README.md`
- `candidates/reconcile/model/bundles/todo/capabilities/cap_create_todo.tg`
- `candidates/reconcile/model/bundles/todo/capabilities/cap_delete_todo.tg`
- `candidates/reconcile/model/bundles/todo/capabilities/cap_list_todos.tg`
- `candidates/reconcile/model/bundles/todo/capabilities/cap_update_todo.tg`
- `candidates/reconcile/model/bundles/todo/decisions/dec_todo.tg`
- `candidates/reconcile/model/bundles/todo/docs/reports/ui-todo_list.md`
- `candidates/reconcile/model/bundles/todo/docs/workflows/workflow_todo.md`
- `candidates/reconcile/model/bundles/todo/entities/entity_todo.tg`
- `candidates/reconcile/model/bundles/todo/shapes/shape_input_create_todo.tg`
- `candidates/reconcile/model/bundles/todo/shapes/shape_input_update_todo.tg`
- `candidates/reconcile/model/bundles/todo/shapes/shape_output_list_todos.tg`
- `candidates/reconcile/model/bundles/user/README.md`
- `candidates/reconcile/model/bundles/user/capabilities/cap_create_user.tg`
- `candidates/reconcile/model/bundles/user/capabilities/cap_delete_user.tg`
- `candidates/reconcile/model/bundles/user/capabilities/cap_list_users.tg`
- `candidates/reconcile/model/bundles/user/capabilities/cap_update_user.tg`
- `candidates/reconcile/model/bundles/user/decisions/dec_user.tg`
- `candidates/reconcile/model/bundles/user/docs/reports/ui-user_list.md`
- `candidates/reconcile/model/bundles/user/docs/workflows/workflow_user.md`
- `candidates/reconcile/model/bundles/user/entities/entity_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_input_create_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_input_update_user.tg`
- `candidates/reconcile/model/bundles/user/shapes/shape_output_list_users.tg`

## Canonical Outputs

- None
