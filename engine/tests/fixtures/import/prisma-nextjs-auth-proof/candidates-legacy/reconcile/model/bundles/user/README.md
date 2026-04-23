# User Candidate Bundle

Concept id: `entity_user`

Entities: 0
Enums: 0
Capabilities: 0
Shapes: 0
Screens: 1
UI routes: 1
UI actions: 1
Workflows: 1
Workflow states: 0
Workflow transitions: 3
Docs: 0

## Suggested Merge

- Action: `merge_into_existing_entity`
- Canonical entity target: `entity_user`

## Suggested Adoption

- `merge_bundle_into_existing_entity` `user` -> `entity_user`
- `promote_workflow_decision` `dec_user`
- `promote_workflow_doc` `workflow_user`
- `promote_ui_report` `ui_user_create`

## Workflow Impacts

- `workflow_review:user` requires workflow review for `workflow_user`

## UI Evidence

- `user_create` form at `/users/new`

## Workflow Evidence

- `workflow_user` for `entity_user`
