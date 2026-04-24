# Product Candidate Bundle

Concept id: `entity_product`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 3
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
- Promote capabilities: `cap_get_product`, `cap_list_products`, `cap_search_products`

## Suggested Adoption

- `promote_entity` `entity_product`
- `promote_capability` `cap_get_product`
- `promote_capability` `cap_list_products`
- `promote_capability` `cap_search_products`
- `promote_workflow_decision` `dec_product`
- `promote_workflow_doc` `workflow_product`

## Workflow Impacts

- `workflow_review:product` requires workflow review for `workflow_product`

## Entity Evidence

- `entity_product` from `src/main/java/com/delivery/data/db/jpa/entities/ProductData.java`

## API Evidence

- `cap_get_product` at `GET /Product/{id}`
- `cap_list_products` at `GET /Product`
- `cap_search_products` at `GET /Product/search/{text}`

## Workflow Evidence

- `workflow_product` for `entity_product`
