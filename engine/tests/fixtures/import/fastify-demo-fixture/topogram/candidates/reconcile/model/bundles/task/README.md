# Task Candidate Bundle

Concept id: `entity_task`

Entities: 1
Enums: 0
Capabilities: 5
Shapes: 6
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_task`, `cap_delete_task`, `cap_get_task`, `cap_list_tasks`, `cap_update_task`
- Promote shapes: `shape_input_create_task`, `shape_input_update_task`, `shape_output_create_task`, `shape_output_get_task`, `shape_output_list_tasks`, `shape_output_update_task`

## Suggested Adoption

- `promote_entity` `entity_task`
- `promote_capability` `cap_create_task`
- `promote_capability` `cap_delete_task`
- `promote_capability` `cap_get_task`
- `promote_capability` `cap_list_tasks`
- `promote_capability` `cap_update_task`
- `promote_shape` `shape_input_create_task`
- `promote_shape` `shape_input_update_task`
- `promote_shape` `shape_output_create_task`
- `promote_shape` `shape_output_get_task`
- `promote_shape` `shape_output_list_tasks`
- `promote_shape` `shape_output_update_task`
- `promote_workflow_decision` `dec_task`
- `promote_workflow_doc` `workflow_task`

## Workflow Impacts

- `workflow_review:task` requires workflow review for `workflow_task`

## Entity Evidence

- `entity_task` from `migrations/002.do.tasks.sql`

## API Evidence

- `cap_create_task` at `POST /tasks`
- `cap_delete_task` at `DELETE /tasks/{id}`
- `cap_get_task` at `GET /tasks/{id}`
- `cap_list_tasks` at `GET /tasks`
- `cap_update_task` at `PATCH /tasks/{id}`

## Workflow Evidence

- `workflow_task` for `entity_task`
