# Todo Candidate Bundle

Concept id: `entity_todo`

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
- Promote capabilities: `cap_create_todo`, `cap_delete_todo`, `cap_list_todos`, `cap_update_todo`
- Promote shapes: `shape_input_create_todo`, `shape_input_update_todo`, `shape_output_list_todos`

## Suggested Adoption

- `promote_entity` `entity_todo`
- `promote_capability` `cap_create_todo`
- `promote_capability` `cap_delete_todo`
- `promote_capability` `cap_list_todos`
- `promote_capability` `cap_update_todo`
- `promote_shape` `shape_input_create_todo`
- `promote_shape` `shape_input_update_todo`
- `promote_shape` `shape_output_list_todos`
- `promote_workflow_decision` `dec_todo`
- `promote_workflow_doc` `workflow_todo`
- `promote_ui_report` `ui_todo_list`

## Workflow Impacts

- `workflow_review:todo` requires workflow review for `workflow_todo`

## Entity Evidence

- `entity_todo` from `#10 - Clean Architecture Version (RxDart + Provider)/lib/features/todo/domain/entities/todo_entity.dart`

## API Evidence

- `cap_create_todo` at `POST /todos`
- `cap_delete_todo` at `DELETE /todos/{id}`
- `cap_list_todos` at `GET /todos`
- `cap_update_todo` at `PUT /todos/{id}`

## UI Evidence

- `todo_list` list at `/todos`

## Workflow Evidence

- `workflow_todo` for `entity_todo`
