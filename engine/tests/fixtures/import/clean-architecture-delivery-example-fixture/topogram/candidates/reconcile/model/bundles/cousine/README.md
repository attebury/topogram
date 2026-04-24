# Cousine Candidate Bundle

Concept id: `entity_cousine`

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
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_list_cousines`, `cap_search_cousines`

## Suggested Adoption

- `promote_entity` `entity_cousine`
- `promote_capability` `cap_list_cousines`
- `promote_capability` `cap_search_cousines`
- `promote_workflow_decision` `dec_cousine`
- `promote_workflow_doc` `workflow_cousine`

## Workflow Impacts

- `workflow_review:cousine` requires workflow review for `workflow_cousine`

## Entity Evidence

- `entity_cousine` from `src/main/java/com/delivery/data/db/jpa/entities/CousineData.java`

## API Evidence

- `cap_list_cousines` at `GET /Cousine`
- `cap_search_cousines` at `GET /Cousine/search/{text}`

## Workflow Evidence

- `workflow_cousine` for `entity_cousine`
