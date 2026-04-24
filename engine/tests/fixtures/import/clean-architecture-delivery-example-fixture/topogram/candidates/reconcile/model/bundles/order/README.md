# Order Candidate Bundle

Concept id: `entity_order`

Actors: 0
Roles: 0
Entities: 1
Enums: 1
Capabilities: 5
Shapes: 0
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote enums: `status`
- Promote capabilities: `cap_create_order`, `cap_delete_order`, `cap_delivery_order`, `cap_get_order`, `cap_pay_order`

## Suggested Adoption

- `promote_entity` `entity_order`
- `promote_enum` `status`
- `promote_capability` `cap_create_order`
- `promote_capability` `cap_delete_order`
- `promote_capability` `cap_delivery_order`
- `promote_capability` `cap_get_order`
- `promote_capability` `cap_pay_order`
- `promote_workflow_decision` `dec_order`
- `promote_workflow_doc` `workflow_order`

## Workflow Impacts

- `workflow_review:order` requires workflow review for `workflow_order`

## Entity Evidence

- `entity_order` from `src/main/java/com/delivery/data/db/jpa/entities/OrderData.java`

## API Evidence

- `cap_create_order` at `POST /Order`
- `cap_delete_order` at `DELETE /Order/{id}`
- `cap_delivery_order` at `POST /Order/{id}/delivery`
- `cap_get_order` at `GET /Order/{id}`
- `cap_pay_order` at `POST /Order/{id}/payment`

## Workflow Evidence

- `workflow_order` for `entity_order`
