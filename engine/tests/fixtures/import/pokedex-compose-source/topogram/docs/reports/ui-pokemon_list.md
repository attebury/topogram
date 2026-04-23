---
id: ui_pokemon_list
kind: report
title: Pokemon List UI Surface
status: inferred
source_of_truth: imported
confidence: high
review_required: true
related_entities:
  - entity_pokemon
provenance:
  - app/src/main/kotlin/com/skydoves/pokedex/compose/navigation/PokedexNavHost.kt#Home
tags:
  - import
  - ui
---

Candidate UI surface imported from brownfield route evidence.

Screen: `pokemon_list` (list)
Routes: `/pokemon`
Actions: `cap_get_pokemon`

Review this UI surface before promoting it into canonical docs or projections.
