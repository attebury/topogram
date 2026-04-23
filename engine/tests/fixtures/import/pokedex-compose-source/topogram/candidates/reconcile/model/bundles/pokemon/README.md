# Pokemon Candidate Bundle

Concept id: `entity_pokemon`

Entities: 1
Enums: 0
Capabilities: 2
Shapes: 2
Screens: 2
UI routes: 2
UI actions: 2
Workflows: 1
Workflow states: 0
Workflow transitions: 0
Docs: 0

## Suggested Merge

- Action: `promote_as_candidate_concept`
- Promote capabilities: `cap_get_pokemon`, `cap_list_pokemons`
- Promote shapes: `shape_output_get_pokemon`, `shape_output_list_pokemons`

## Suggested Adoption

- `promote_entity` `entity_pokemon`
- `promote_capability` `cap_get_pokemon`
- `promote_capability` `cap_list_pokemons`
- `promote_shape` `shape_output_get_pokemon`
- `promote_shape` `shape_output_list_pokemons`
- `promote_workflow_decision` `dec_pokemon`
- `promote_workflow_doc` `workflow_pokemon`
- `promote_ui_report` `ui_pokemon_detail`
- `promote_ui_report` `ui_pokemon_list`

## Workflow Impacts

- `workflow_review:pokemon` requires workflow review for `workflow_pokemon`

## Entity Evidence

- `entity_pokemon` from `core/database/src/main/kotlin/com/skydoves/pokedex/compose/core/database/entitiy/PokemonEntity.kt`

## API Evidence

- `cap_get_pokemon` at `GET /pokemon/{name}`
- `cap_list_pokemons` at `GET /pokemon`

## UI Evidence

- `pokemon_detail` detail at `/pokemon/:name`
- `pokemon_list` list at `/pokemon`

## Workflow Evidence

- `workflow_pokemon` for `entity_pokemon`
