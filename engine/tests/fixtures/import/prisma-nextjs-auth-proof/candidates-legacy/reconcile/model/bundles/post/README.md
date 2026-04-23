# Post Candidate Bundle

Concept id: `entity_post`

Entities: 0
Enums: 0
Capabilities: 1
Shapes: 1
Screens: 3
UI routes: 3
UI actions: 3
Workflows: 0
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `merge_into_existing_entity`
- Canonical entity target: `entity_post`
- Promote capabilities: `cap_create_post`
- Promote shapes: `shape_input_create_post`

## Suggested Adoption

- `merge_bundle_into_existing_entity` `post` -> `entity_post`
- `merge_capability_into_existing_entity` `cap_create_post` -> `entity_post`
- `promote_shape` `shape_input_create_post` -> `entity_post`
- `promote_ui_report` `ui_post_create`
- `promote_ui_report` `ui_post_detail`
- `promote_ui_report` `ui_post_list`

## API Evidence

- `cap_create_post` at `POST /posts/new`

## UI Evidence

- `post_create` form at `/posts/new`
- `post_detail` detail at `/posts/:id`
- `post_list` list at `/posts`
