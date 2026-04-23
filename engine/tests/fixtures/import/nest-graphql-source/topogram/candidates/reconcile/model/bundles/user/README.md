# User Candidate Bundle

Concept id: `entity_user`

Entities: 1
Enums: 0
Capabilities: 2
Shapes: 3
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_list_users`, `cap_register_user`
- Promote shapes: `shape_input_register_user`, `shape_output_list_users`, `shape_output_register_user`

## Suggested Adoption

- `promote_entity` `entity_user`
- `promote_capability` `cap_list_users`
- `promote_capability` `cap_register_user`
- `promote_shape` `shape_input_register_user`
- `promote_shape` `shape_output_list_users`
- `promote_shape` `shape_output_register_user`
- `promote_workflow_decision` `dec_user`
- `promote_workflow_doc` `workflow_user`

## Workflow Impacts

- `workflow_review:user` requires workflow review for `workflow_user`

## Entity Evidence

- `entity_user` from `engine/tests/fixtures/import/nest-graphql-source/prisma/schema.prisma`

## API Evidence

- `cap_list_users` at `GET /graphql`
- `cap_register_user` at `POST /graphql`

## Workflow Evidence

- `workflow_user` for `entity_user`
