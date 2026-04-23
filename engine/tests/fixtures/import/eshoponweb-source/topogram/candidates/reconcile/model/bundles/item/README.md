# Item Candidate Bundle

Concept id: `entity_item`

Actors: 0
Roles: 0
Entities: 0
Enums: 0
Capabilities: 3
Shapes: 0
Screens: 1
UI routes: 1
UI actions: 0
Workflows: 1
Verifications: 0
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_item`, `cap_get_item`, `cap_list_items`

## Suggested Adoption

- `promote_capability` `cap_create_item`
- `promote_capability` `cap_get_item`
- `promote_capability` `cap_list_items`
- `promote_workflow_decision` `dec_item`
- `promote_workflow_doc` `workflow_item`
- `promote_ui_report` `ui_catalog_home`

## Workflow Impacts

- `workflow_review:item` requires workflow review for `workflow_item`

## API Evidence

- `cap_create_item` at `POST /`
- `cap_get_item` at `GET /{orderId}`
- `cap_list_items` at `GET /`

## UI Evidence

- `catalog_home` list at `/`

## Workflow Evidence

- `workflow_item` for `entity_item`
