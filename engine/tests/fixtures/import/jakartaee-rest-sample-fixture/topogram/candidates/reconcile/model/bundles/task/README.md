# Task Candidate Bundle

Concept id: `entity_task`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 6
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
- Promote capabilities: `cap_create_task`, `cap_delete_task`, `cap_get_task`, `cap_list_tasks`, `cap_update_task`, `cap_update_task_status`
- Promote shapes: `shape_input_create_task`, `shape_input_update_task`, `shape_input_update_task_status`

## Suggested Adoption

- `promote_entity` `entity_task`
- `promote_capability` `cap_create_task`
- `promote_capability` `cap_delete_task`
- `promote_capability` `cap_get_task`
- `promote_capability` `cap_list_tasks`
- `promote_capability` `cap_update_task`
- `promote_capability` `cap_update_task_status`
- `promote_shape` `shape_input_create_task`
- `promote_shape` `shape_input_update_task`
- `promote_shape` `shape_input_update_task_status`
- `promote_workflow_decision` `dec_task`
- `promote_workflow_doc` `workflow_task`

## Workflow Impacts

- `workflow_review:task` requires workflow review for `workflow_task`

## Entity Evidence

- `entity_task` from `src/main/java/com/example/domain/task/Task.java`

## API Evidence

- `cap_create_task` at `POST /tasks`
- `cap_delete_task` at `DELETE /tasks/{id}`
- `cap_get_task` at `GET /tasks/{id}`
- `cap_list_tasks` at `GET /tasks`
- `cap_update_task` at `PUT /tasks/{id}`
- `cap_update_task_status` at `PUT /tasks/{id}/status`

## Workflow Evidence

- `workflow_task` for `entity_task`
