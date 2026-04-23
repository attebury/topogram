# Post Candidate Bundle

Concept id: `entity_post`

Entities: 1
Enums: 0
Capabilities: 4
Shapes: 3
Screens: 3
UI routes: 3
UI actions: 8
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_post`, `cap_delete_post`, `cap_list_posts`, `cap_update_post`
- Promote shapes: `shape_input_create_post`, `shape_input_update_post`, `shape_output_list_posts`

## Suggested Adoption

- `promote_entity` `entity_post`
- `promote_capability` `cap_create_post`
- `promote_capability` `cap_delete_post`
- `promote_capability` `cap_list_posts`
- `promote_capability` `cap_update_post`
- `promote_shape` `shape_input_create_post`
- `promote_shape` `shape_input_update_post`
- `promote_shape` `shape_output_list_posts`
- `promote_workflow_decision` `dec_post`
- `promote_workflow_doc` `workflow_post`
- `promote_ui_report` `ui_create_post`
- `promote_ui_report` `ui_post_detail`
- `promote_ui_report` `ui_post_list`

## Workflow Impacts

- `workflow_review:post` requires workflow review for `workflow_post`

## Entity Evidence

- `entity_post` from `#10 - Clean Architecture Version (RxDart + Provider)/lib/features/post/domain/entities/post_entity.dart`

## API Evidence

- `cap_create_post` at `POST /posts`
- `cap_delete_post` at `DELETE /posts/{id}`
- `cap_list_posts` at `GET /posts`
- `cap_update_post` at `PUT /posts/{id}`

## UI Evidence

- `create_post` form at `/posts/new`
- `post_detail` detail at `/posts/:id`
- `post_list` list at `/posts`

## Workflow Evidence

- `workflow_post` for `entity_post`
