---
id: package_audience_journey_map
kind: report
title: Package Audience Journey Map
status: canonical
summary: Current user journey map for Topogram packages, templates, generators, extractor packs, catalog entries, and agent workflows.
related_capabilities:
  - cap_create_project
  - cap_manage_catalog
  - cap_manage_templates
  - cap_manage_generators
  - cap_import_brownfield_app
  - cap_reconcile_import_candidates
  - cap_adopt_import_candidates
  - cap_query_context
affects:
  - journey_greenfield_start_from_template
  - journey_reuse_pure_topogram_package
  - journey_brownfield_import_and_adoption
  - journey_agent_maintains_from_topo
  - journey_template_author_composes_starter
  - journey_generator_author_publishes_pack
  - journey_extractor_author_publishes_pack
  - journey_catalog_curator_indexes_packages
domain: dom_catalog_templates
tags:
  - report
  - journeys
  - packages
  - templates
---

This report is supporting documentation. The canonical journeys are the
graph-native `journey_*` statements under `topo/journeys/`; update those records
when changing workflow intent, ordered steps, alternates, or related graph
links.

This map is the current audience model for organizing Topogram package surfaces.

| Journey | Primary audience | Package surfaces | Core boundary |
| --- | --- | --- | --- |
| `journey_greenfield_start_from_template` | Consumer developer, agent | Template package, generator packages, catalog alias | Templates copy starter content; generators execute from installed dependencies. |
| `journey_reuse_pure_topogram_package` | Consumer developer, agent | Pure Topogram package, catalog entry | Copy `topo/` only; provenance is audit, not a lock. |
| `journey_brownfield_import_and_adoption` | Maintainer, agent | Extractor packs, candidate output | Extract emits reviewable candidates; adoption writes canonical `topo/**` only when explicit. |
| `journey_agent_maintains_from_topo` | Coding agent | Query packets, SDLC records, policies | Queries are read-only; stateful mutations use commands. |
| `journey_template_author_composes_starter` | Template author | Template package, generator package dependencies | Templates compose packs and policies; reusable stack realization belongs in generators. |
| `journey_generator_author_publishes_pack` | Generator author | Generator package | Generators execute from normalized contracts and must prove generated output. |
| `journey_extractor_author_publishes_pack` | Extractor author | Extractor package | Extractor packs execute discovery only; core owns persistence, reconcile, and adoption. |
| `journey_catalog_curator_indexes_packages` | Maintainer, release manager | Catalog entries, package versions | Catalog indexes packages; it does not store executable code. |

## Organizing Rules

- Content packages copy into projects: templates and pure Topogram packages.
- Execution packages are installed, policy-checked, and invoked: generators and extractor packs.
- Extractors are units inside extractor packs, not user-facing content packages.
- Catalog entries point to versioned packages and trust metadata; they are not the source package.
- Copied `topo/` content becomes project-owned after ingestion.
- Command-owned sidecars, trust hashes, source provenance, release status, and SDLC history stay command-owned.

## Next Modeling Pressure

Package-backed extractors need their own manifest and policy surface before we add external extractor packs. The journey map says extractor packs should mirror generators in package handling, but their output contract must be candidate/evidence-only.
