# Post Candidate Bundle

Concept id: `entity_post`

Entities: 1
Enums: 0
Capabilities: 3
Shapes: 0
Screens: 2
UI routes: 2
UI actions: 1
Workflows: 1
Workflow states: 0
Workflow transitions: 1
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_post`, `cap_get_post`, `cap_list_posts`

## Suggested Adoption

- `promote_entity` `entity_post`
- `promote_capability` `cap_create_post`
- `promote_capability` `cap_get_post`
- `promote_capability` `cap_list_posts`
- `promote_workflow_decision` `dec_post`
- `promote_workflow_doc` `workflow_post`
- `promote_ui_report` `ui_post_detail`
- `promote_ui_report` `ui_post_list`

## Workflow Impacts

- `workflow_review:post` requires workflow review for `workflow_post`

## Entity Evidence

- `entity_post` from `prisma/schema.prisma`

## API Evidence

- `cap_create_post` at `POST /posts`
- `cap_get_post` at `GET /posts/{id}`
- `cap_list_posts` at `GET /posts`

## UI Evidence

- `post_detail` detail at `/post/:id`
- `post_list` list at `/`

## Workflow Evidence

- `workflow_post` for `entity_post`
