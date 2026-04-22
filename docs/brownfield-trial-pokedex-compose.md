# Brownfield Trial: Pokedex Compose

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/pokedex-compose`
- Source: `skydoves/pokedex-compose`

## What This Trial Proved

This trial confirmed that Topogram can import and adopt a credible Android domain surface from a real Jetpack Compose app using:

- Room entities and DAOs
- Retrofit service interfaces
- Compose navigation and screen entry points

## Import Coverage

Current Android support in Topogram covers:

- `db/room`
  - `@Entity`
  - `@PrimaryKey`
  - `@Dao`
  - basic DAO query/insert capability hints
- `api/retrofit`
  - `@GET`, `@POST`, `@PUT`, `@PATCH`, `@DELETE`
  - `@Query`
  - `@Path`
  - interface-based endpoint/capability inference
- `ui/android-compose`
  - Compose screen discovery
  - navigation host entry extraction
  - route/screen inference for list/detail/settings-style surfaces

## Imported Domain Surface

Recovered candidate bundles:

- `pokemon`
- `pokemon-info`
- `surface-settings`

The strongest canonical proof is the `pokemon` bundle, which groups:

- `entity_pokemon`
- `cap_list_pokemons`
- `cap_get_pokemon`
- `pokemon_list`
- `pokemon_detail`
- `workflow_pokemon`

## Canonical Outputs

Canonical outputs now exist under:

- `/Users/attebury/Documents/topogram/trials/pokedex-compose/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/pokedex-compose/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/pokedex-compose/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/pokedex-compose/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/pokedex-compose/topogram/docs/workflows`
- `/Users/attebury/Documents/topogram/trials/pokedex-compose/topogram/docs/reports`

Representative promoted files include:

- `entity-pokemon.tg`
- `cap-list-pokemons.tg`
- `cap-get-pokemon.tg`
- `decision-pokemon.tg`
- `workflow_pokemon.md`
- `ui-pokemon_list.md`
- `ui-pokemon_detail.md`

## Important Current Boundary

The persisted adoption-status view is still slightly conservative after promotion, similar to the ASP.NET Core workflow-review accounting edge. The canonical files on disk are the reliable proof surface.

This is a status/accounting refinement issue, not an Android extractor gap.

## Why This Is Enough To Move Forward

Android is now a credible confirmed proof for mobile/domain brownfield import because Topogram can:

- recover persisted data concepts from Room
- recover API capabilities from Retrofit
- recover screen structure from Compose navigation
- reconcile those signals into a meaningful `pokemon` concept
- promote that concept into canonical Topogram files

## Deferred For Android v1

- deeper ViewModel-driven workflow/action extraction
- Room relation graph reconstruction beyond simple entities
- stronger support for large modular apps like `nowinandroid`
- XML layout / Fragment / Activity extraction
