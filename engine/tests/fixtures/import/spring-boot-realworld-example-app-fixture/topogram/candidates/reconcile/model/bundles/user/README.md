# User Candidate Bundle

Concept id: `entity_user`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 3
Shapes: 4
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_user`, `cap_get_user`, `cap_update_user`
- Promote shapes: `shape_input_create_user`, `shape_output_create_user`, `shape_output_get_user`, `shape_output_update_user`

## Suggested Adoption

- `promote_entity` `entity_user`
- `promote_capability` `cap_create_user`
- `promote_capability` `cap_get_user`
- `promote_capability` `cap_update_user`
- `promote_shape` `shape_input_create_user`
- `promote_shape` `shape_output_create_user`
- `promote_shape` `shape_output_get_user`
- `promote_shape` `shape_output_update_user`
- `promote_workflow_decision` `dec_user`
- `promote_workflow_doc` `workflow_user`

## Workflow Impacts

- `workflow_review:user` requires workflow review for `workflow_user`

## Entity Evidence

- `entity_user` from `src/main/resources/db/migration/V1__create_tables.sql`

## API Evidence

- `cap_create_user` at `POST /users/users`
- `cap_get_user` at `GET /user`
- `cap_update_user` at `PUT /user`

## Workflow Evidence

- `workflow_user` for `entity_user`
