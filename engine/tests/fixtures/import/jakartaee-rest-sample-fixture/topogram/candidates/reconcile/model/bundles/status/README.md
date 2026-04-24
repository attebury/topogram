# Status Candidate Bundle

Concept id: `entity_status`

Actors: 0
Roles: 0
Entities: 0
Enums: 0
Capabilities: 4
Shapes: 2
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_delete_status`, `cap_get_task`, `cap_update_status_status`, `cap_update_task_status`
- Promote shapes: `shape_input_update_status_status`, `shape_input_update_task_status`

## Suggested Adoption

- `promote_capability` `cap_delete_status`
- `promote_capability` `cap_get_task`
- `promote_capability` `cap_update_status_status`
- `promote_capability` `cap_update_task_status`
- `promote_shape` `shape_input_update_status_status`
- `promote_shape` `shape_input_update_task_status`
- `promote_workflow_decision` `dec_status`
- `promote_workflow_doc` `workflow_status`

## Workflow Impacts

- `workflow_review:status` requires workflow review for `workflow_status`

## API Evidence

- `cap_delete_status` at `DELETE /status`
- `cap_get_task` at `GET /status`
- `cap_update_status_status` at `PUT /status`
- `cap_update_task_status` at `PUT /status/status`

## Workflow Evidence

- `workflow_status` for `entity_status`
