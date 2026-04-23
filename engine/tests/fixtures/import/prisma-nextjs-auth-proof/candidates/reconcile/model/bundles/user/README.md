# User Candidate Bundle

Concept id: `entity_user`

Entities: 1
Enums: 0
Capabilities: 3
Shapes: 3
Screens: 1
UI routes: 1
UI actions: 1
Workflows: 1
Workflow states: 0
Workflow transitions: 3
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_user`, `cap_register_user`, `cap_sign_in_user`
- Promote shapes: `shape_input_create_user`, `shape_input_register_user`, `shape_input_sign_in_user`

## Suggested Adoption

- `promote_entity` `entity_user`
- `promote_capability` `cap_create_user`
- `promote_capability` `cap_register_user`
- `promote_capability` `cap_sign_in_user`
- `promote_shape` `shape_input_create_user`
- `promote_shape` `shape_input_register_user`
- `promote_shape` `shape_input_sign_in_user`
- `promote_workflow_decision` `dec_user`
- `promote_workflow_doc` `workflow_user`
- `promote_ui_report` `ui_user_create`

## Workflow Impacts

- `workflow_review:user` requires workflow review for `workflow_user`

## Entity Evidence

- `entity_user` from `prisma/schema.prisma`

## API Evidence

- `cap_create_user` at `POST /users/new`
- `cap_register_user` at `POST /register`
- `cap_sign_in_user` at `POST /login`

## UI Evidence

- `user_create` form at `/users/new`

## Workflow Evidence

- `workflow_user` for `entity_user`
