# User Candidate Bundle

Concept id: `entity_user`

Entities: 1
Enums: 0
Capabilities: 1
Shapes: 2
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_update_user`
- Promote shapes: `shape_input_update_user`, `shape_output_update_user`

## Suggested Adoption

- `promote_entity` `entity_user`
- `promote_capability` `cap_update_user`
- `promote_shape` `shape_input_update_user`
- `promote_shape` `shape_output_update_user`
- `promote_workflow_decision` `dec_user`
- `promote_workflow_doc` `workflow_user`

## Workflow Impacts

- `workflow_review:user` requires workflow review for `workflow_user`

## Entity Evidence

- `entity_user` from `migrations/001.do.users.sql`

## API Evidence

- `cap_update_user` at `PUT /users/update-password`

## Workflow Evidence

- `workflow_user` for `entity_user`
