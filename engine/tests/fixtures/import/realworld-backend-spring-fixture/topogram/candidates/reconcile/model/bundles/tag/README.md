# Tag Candidate Bundle

Concept id: `entity_tag`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 1
Shapes: 1
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_list_tags`
- Promote shapes: `shape_output_list_tags`

## Suggested Adoption

- `promote_entity` `entity_tag`
- `promote_capability` `cap_list_tags`
- `promote_shape` `shape_output_list_tags`
- `promote_workflow_decision` `dec_tag`
- `promote_workflow_doc` `workflow_tag`

## Workflow Impacts

- `workflow_review:tag` requires workflow review for `workflow_tag`

## Entity Evidence

- `entity_tag` from `service/src/main/resources/db/changelog/changes/01-schema.xml`

## API Evidence

- `cap_list_tags` at `GET /tags`

## Workflow Evidence

- `workflow_tag` for `entity_tag`
