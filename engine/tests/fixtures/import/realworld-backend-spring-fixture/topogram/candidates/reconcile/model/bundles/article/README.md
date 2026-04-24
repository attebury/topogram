# Article Candidate Bundle

Concept id: `entity_article`

Actors: 0
Roles: 0
Entities: 1
Enums: 0
Capabilities: 8
Shapes: 9
Screens: 0
UI routes: 0
UI actions: 0
Workflows: 1
Workflow states: 0
Workflow transitions: 2
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_create_article`, `cap_delete_article`, `cap_favorite_article`, `cap_feed_article`, `cap_get_article`, `cap_list_articles`, `cap_unfavorite_article`, `cap_update_article`
- Promote shapes: `shape_input_create_article`, `shape_input_update_article`, `shape_output_create_article`, `shape_output_favorite_article`, `shape_output_feed_article`, `shape_output_get_article`, `shape_output_list_articles`, `shape_output_unfavorite_article`, `shape_output_update_article`

## Suggested Adoption

- `promote_entity` `entity_article`
- `promote_capability` `cap_create_article`
- `promote_capability` `cap_delete_article`
- `promote_capability` `cap_favorite_article`
- `promote_capability` `cap_feed_article`
- `promote_capability` `cap_get_article`
- `promote_capability` `cap_list_articles`
- `promote_capability` `cap_unfavorite_article`
- `promote_capability` `cap_update_article`
- `promote_shape` `shape_input_create_article`
- `promote_shape` `shape_input_update_article`
- `promote_shape` `shape_output_create_article`
- `promote_shape` `shape_output_favorite_article`
- `promote_shape` `shape_output_feed_article`
- `promote_shape` `shape_output_get_article`
- `promote_shape` `shape_output_list_articles`
- `promote_shape` `shape_output_unfavorite_article`
- `promote_shape` `shape_output_update_article`
- `promote_workflow_decision` `dec_article`
- `promote_workflow_doc` `workflow_article`

## Workflow Impacts

- `workflow_review:article` requires workflow review for `workflow_article`

## Entity Evidence

- `entity_article` from `service/src/main/resources/db/changelog/changes/01-schema.xml`

## API Evidence

- `cap_create_article` at `POST /articles`
- `cap_delete_article` at `DELETE /articles/{slug}`
- `cap_favorite_article` at `POST /articles/{slug}/favorite`
- `cap_feed_article` at `GET /articles/feed`
- `cap_get_article` at `GET /articles/{slug}`
- `cap_list_articles` at `GET /articles`
- `cap_unfavorite_article` at `DELETE /articles/{slug}/favorite`
- `cap_update_article` at `PUT /articles/{slug}`

## Workflow Evidence

- `workflow_article` for `entity_article`
