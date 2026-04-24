# Profile Candidate Bundle

Concept id: `entity_profile`

Entities: 0
Enums: 0
Capabilities: 3
Shapes: 3
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_follow_profile`, `cap_get_profile`, `cap_unfollow_profile`
- Promote shapes: `shape_output_follow_profile`, `shape_output_get_profile`, `shape_output_unfollow_profile`

## Suggested Adoption

- `promote_capability` `cap_follow_profile`
- `promote_capability` `cap_get_profile`
- `promote_capability` `cap_unfollow_profile`
- `promote_shape` `shape_output_follow_profile`
- `promote_shape` `shape_output_get_profile`
- `promote_shape` `shape_output_unfollow_profile`
- `promote_workflow_decision` `dec_profile`
- `promote_workflow_doc` `workflow_profile`

## Workflow Impacts

- `workflow_review:profile` requires workflow review for `workflow_profile`

## API Evidence

- `cap_follow_profile` at `POST /profiles/{username}/follow`
- `cap_get_profile` at `GET /profiles/{username}`
- `cap_unfollow_profile` at `DELETE /profiles/{username}/follow`

## Workflow Evidence

- `workflow_profile` for `entity_profile`
