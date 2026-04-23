# User Candidate Bundle

Concept id: `entity_user`

Entities: 1
Enums: 0
Capabilities: 4
Shapes: 3
Screens: 1
UI routes: 1
UI actions: 4
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_user`, `cap_delete_user`, `cap_list_users`, `cap_update_user`
- Promote shapes: `shape_input_create_user`, `shape_input_update_user`, `shape_output_list_users`

## Suggested Adoption

- `promote_entity` `entity_user`
- `promote_capability` `cap_create_user`
- `promote_capability` `cap_delete_user`
- `promote_capability` `cap_list_users`
- `promote_capability` `cap_update_user`
- `promote_shape` `shape_input_create_user`
- `promote_shape` `shape_input_update_user`
- `promote_shape` `shape_output_list_users`
- `promote_workflow_decision` `dec_user`
- `promote_workflow_doc` `workflow_user`
- `promote_ui_report` `ui_user_list`

## Workflow Impacts

- `workflow_review:user` requires workflow review for `workflow_user`

## Entity Evidence

- `entity_user` from `#10 - Clean Architecture Version (RxDart + Provider)/lib/features/user/domain/entities/user_entity.dart`

## API Evidence

- `cap_create_user` at `POST /users`
- `cap_delete_user` at `DELETE /users/{id}`
- `cap_list_users` at `GET /users`
- `cap_update_user` at `PUT /users/{id}`

## UI Evidence

- `user_list` list at `/users`

## Workflow Evidence

- `workflow_user` for `entity_user`
