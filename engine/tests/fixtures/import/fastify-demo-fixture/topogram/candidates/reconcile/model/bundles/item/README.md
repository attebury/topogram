# Item Candidate Bundle

Concept id: `entity_item`

Entities: 0
Enums: 0
Capabilities: 1
Shapes: 0
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_list_items`

## Suggested Adoption

- `promote_capability` `cap_list_items`
- `promote_workflow_decision` `dec_item`
- `promote_workflow_doc` `workflow_item`

## Workflow Impacts

- `workflow_review:item` requires workflow review for `workflow_item`

## API Evidence

- `cap_list_items` at `GET /`

## Workflow Evidence

- `workflow_item` for `entity_item`
