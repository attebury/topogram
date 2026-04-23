# Post Candidate Bundle

Concept id: `entity_post`

Entities: 1
Enums: 0
Capabilities: 2
Shapes: 2
Screens: 2
UI routes: 2
UI actions: 2
Workflows: 1
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_get_post`, `cap_list_posts`
- Promote shapes: `shape_output_get_post`, `shape_output_list_posts`

## Suggested Adoption

- `promote_entity` `entity_post`
- `promote_capability` `cap_get_post`
- `promote_capability` `cap_list_posts`
- `promote_shape` `shape_output_get_post`
- `promote_shape` `shape_output_list_posts`
- `promote_workflow_decision` `dec_post`
- `promote_workflow_doc` `workflow_post`
- `promote_ui_report` `ui_post_detail`
- `promote_ui_report` `ui_post_list`

## Workflow Impacts

- `workflow_review:post` requires workflow review for `workflow_post`

## Entity Evidence

- `entity_post` from `src/post/domain/entities/PostEntity.ts`

## API Evidence

- `cap_get_post` at `GET /posts/{id}`
- `cap_list_posts` at `GET /posts`

## UI Evidence

- `post_detail` detail at `/posts/:id`
- `post_list` list at `/posts`

## Workflow Evidence

- `workflow_post` for `entity_post`
