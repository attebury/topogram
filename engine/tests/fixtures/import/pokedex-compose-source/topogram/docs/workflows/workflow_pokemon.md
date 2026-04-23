---
id: workflow_pokemon
kind: workflow
title: Pokemon Workflow
status: inferred
source_of_truth: imported
confidence: medium
review_required: true
related_entities:
  - entity_pokemon
related_capabilities:
  - cap_get_pokemon
  - cap_list_pokemons
provenance:
  - core/network/src/main/kotlin/com/skydoves/pokedex/compose/core/network/service/PokedexService.kt#GET /pokemon
tags:
  - import
  - workflow
---

Candidate workflow imported from brownfield evidence.

Entity: `entity_pokemon`
States: _none_
Transitions: _none_

Review this workflow before promoting it as canonical.
