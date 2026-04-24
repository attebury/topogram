# Store Candidate Bundle

Concept id: `entity_store`

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
- Promote capabilities: `cap_get_store`, `cap_list_stores`, `cap_search_stores`

## Suggested Adoption

- `promote_entity` `entity_store`
- `promote_capability` `cap_get_store`
- `promote_capability` `cap_list_stores`
- `promote_capability` `cap_search_stores`
- `promote_workflow_decision` `dec_store`
- `promote_workflow_doc` `workflow_store`

## Workflow Impacts

- `workflow_review:store` requires workflow review for `workflow_store`

## Entity Evidence

- `entity_store` from `src/main/java/com/delivery/data/db/jpa/entities/StoreData.java`

## API Evidence

- `cap_get_store` at `GET /Store/{id}`
- `cap_list_stores` at `GET /Cousine/{id}/stores`
- `cap_search_stores` at `GET /Store/search/{text}`

## Workflow Evidence

- `workflow_store` for `entity_store`
