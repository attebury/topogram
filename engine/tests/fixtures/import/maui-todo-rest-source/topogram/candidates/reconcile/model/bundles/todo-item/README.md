# Todo Item Candidate Bundle

Concept id: `entity_todo-item`

Entities: 1
Enums: 0
Capabilities: 4
Shapes: 1
Screens: 2
UI routes: 2
UI actions: 4
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_todo_item`, `cap_delete_todo_item`, `cap_list_todo_items`, `cap_update_todo_item`
- Promote shapes: `shape_input_update_todo_item`

## Suggested Adoption

- `promote_entity` `entity_todo-item`
- `promote_capability` `cap_create_todo_item`
- `promote_capability` `cap_delete_todo_item`
- `promote_capability` `cap_list_todo_items`
- `promote_capability` `cap_update_todo_item`
- `promote_shape` `shape_input_update_todo_item`
- `promote_workflow_decision` `dec_todo-item`
- `promote_workflow_doc` `workflow_todo-item`
- `promote_ui_report` `ui_todo_item`
- `promote_ui_report` `ui_todo_list`

## Workflow Impacts

- `workflow_review:todo-item` requires workflow review for `workflow_todo-item`

## Entity Evidence

- `entity_todo-item` from `10.0/WebServices/TodoREST/TodoAPI/Models/TodoItem.cs`, `10.0/WebServices/TodoREST/TodoREST/Models/TodoItem.cs`

## API Evidence

- `cap_create_todo_item` at `POST /`
- `cap_delete_todo_item` at `DELETE /{id}`
- `cap_list_todo_items` at `GET /`
- `cap_update_todo_item` at `PUT /`

## UI Evidence

- `todo_item` flow at `/todo-item`
- `todo_list` flow at `/MainPage`

## Workflow Evidence

- `workflow_todo-item` for `entity_todo-item`
