# Customer Candidate Bundle

Concept id: `entity_customer`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 2
Shapes: 0
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_customer`, `cap_get_customer`

## Suggested Adoption

- `promote_entity` `entity_customer`
- `promote_capability` `cap_create_customer`
- `promote_capability` `cap_get_customer`
- `promote_workflow_decision` `dec_customer`
- `promote_workflow_doc` `workflow_customer`

## Workflow Impacts

- `workflow_review:customer` requires workflow review for `workflow_customer`

## Entity Evidence

- `entity_customer` from `src/main/java/com/delivery/data/db/jpa/entities/CustomerData.java`

## API Evidence

- `cap_create_customer` at `POST /Customer`
- `cap_get_customer` at `GET /Order/{id}/customer`

## Workflow Evidence

- `workflow_customer` for `entity_customer`
