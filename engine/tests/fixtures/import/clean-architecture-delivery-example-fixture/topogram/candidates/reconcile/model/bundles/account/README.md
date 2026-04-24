# Account Candidate Bundle

Concept id: `entity_account`

Actors: 0
Roles: 0
Entities: 0
Enums: 0
Capabilities: 1
Shapes: 1
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_sign_in_account`
- Promote shapes: `shape_output_sign_in_account`

## Suggested Adoption

- `promote_capability` `cap_sign_in_account`
- `promote_shape` `shape_output_sign_in_account`
- `promote_workflow_decision` `dec_account`
- `promote_workflow_doc` `workflow_account`

## Workflow Impacts

- `workflow_review:account` requires workflow review for `workflow_account`

## API Evidence

- `cap_sign_in_account` at `POST /Customer/auth`

## Workflow Evidence

- `workflow_account` for `entity_account`
