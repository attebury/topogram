---
id: ui_pokemon_detail
kind: report
title: Pokemon Detail UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
related_entities:
  - entity_pokemon
provenance:
  - app/src/main/kotlin/com/skydoves/pokedex/compose/navigation/PokedexNavHost.kt#Details
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `pokemon_detail` (detail)
Routes: `/pokemon/:name`
Actions: `cap_list_pokemons`

Review this UI surface before promoting it into canonical docs or projections.
