# Comment Candidate Bundle

Concept id: `entity_comment`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 3
Shapes: 3
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_comment`, `cap_delete_comment`, `cap_list_comments`
- Promote shapes: `shape_input_create_comment`, `shape_output_create_comment`, `shape_output_list_comments`

## Suggested Adoption

- `promote_entity` `entity_comment`
- `promote_capability` `cap_create_comment`
- `promote_capability` `cap_delete_comment`
- `promote_capability` `cap_list_comments`
- `promote_shape` `shape_input_create_comment`
- `promote_shape` `shape_output_create_comment`
- `promote_shape` `shape_output_list_comments`
- `promote_workflow_decision` `dec_comment`
- `promote_workflow_doc` `workflow_comment`

## Workflow Impacts

- `workflow_review:comment` requires workflow review for `workflow_comment`

## Entity Evidence

- `entity_comment` from `service/src/main/resources/db/changelog/changes/01-schema.xml`

## API Evidence

- `cap_create_comment` at `POST /articles/{slug}/comments`
- `cap_delete_comment` at `DELETE /articles/{slug}/comments/{id}`
- `cap_list_comments` at `GET /articles/{slug}/comments`

## Workflow Evidence

- `workflow_comment` for `entity_comment`
