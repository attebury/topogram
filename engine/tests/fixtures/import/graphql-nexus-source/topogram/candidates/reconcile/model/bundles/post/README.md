# Post Candidate Bundle

Concept id: `entity_post`

Entities: 1
Enums: 0
Capabilities: 6
Shapes: 12
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 3
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_post`, `cap_delete_post`, `cap_get_post`, `cap_list_posts`, `cap_publish_post`, `cap_update_post_view_count`
- Promote shapes: `shape_input_create_post`, `shape_input_delete_post`, `shape_input_get_post`, `shape_input_list_posts`, `shape_input_publish_post`, `shape_input_update_post_view_count`, `shape_output_create_post`, `shape_output_delete_post`, `shape_output_get_post`, `shape_output_list_posts`, `shape_output_publish_post`, `shape_output_update_post_view_count`

## Suggested Adoption

- `promote_entity` `entity_post`
- `promote_capability` `cap_create_post`
- `promote_capability` `cap_delete_post`
- `promote_capability` `cap_get_post`
- `promote_capability` `cap_list_posts`
- `promote_capability` `cap_publish_post`
- `promote_capability` `cap_update_post_view_count`
- `promote_shape` `shape_input_create_post`
- `promote_shape` `shape_input_delete_post`
- `promote_shape` `shape_input_get_post`
- `promote_shape` `shape_input_list_posts`
- `promote_shape` `shape_input_publish_post`
- `promote_shape` `shape_input_update_post_view_count`
- `promote_shape` `shape_output_create_post`
- `promote_shape` `shape_output_delete_post`
- `promote_shape` `shape_output_get_post`
- `promote_shape` `shape_output_list_posts`
- `promote_shape` `shape_output_publish_post`
- `promote_shape` `shape_output_update_post_view_count`
- `promote_workflow_decision` `dec_post`
- `promote_workflow_doc` `workflow_post`

## Workflow Impacts

- `workflow_review:post` requires workflow review for `workflow_post`

## Entity Evidence

- `entity_post` from `orm/graphql-nexus/prisma/schema.prisma`

## API Evidence

- `cap_create_post` at `POST /graphql`
- `cap_delete_post` at `POST /graphql`
- `cap_get_post` at `GET /graphql`
- `cap_list_posts` at `GET /graphql`
- `cap_publish_post` at `POST /graphql`
- `cap_update_post_view_count` at `POST /graphql`

## Workflow Evidence

- `workflow_post` for `entity_post`
