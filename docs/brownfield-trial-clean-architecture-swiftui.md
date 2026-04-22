# Brownfield Trial: Clean Architecture SwiftUI

## Repo

- Trial repo: `./trials/clean-architecture-swiftui`
- Source: `nalexn/clean-architecture-swiftui`

## What This Trial Proved

This trial confirmed that Topogram can recover a credible iOS domain surface from a real SwiftUI app using:

- SwiftData `@Model` classes
- Swift repository-based networking
- SwiftUI screen structure and navigation surfaces

It is also a useful regression proof for conservative UI flow recovery:

- list, detail, and modal screens remain grouped under the `country` flow
- mixed UI and workflow evidence continues to read as one stable review surface

## Import Coverage

Current iOS support in Topogram covers:

- `db/swiftdata`
  - `@Model`
  - field extraction
  - basic relation hints
- `api/swift-webapi`
  - repository discovery in `WebAPI/`
  - async method to capability inference
  - path/query extraction from endpoint enums
- `ui/swiftui`
  - `struct ... : View`
  - list/detail/modal screen inference
  - route and capability hints from view code

## Imported Domain Surface

Recovered bundles include:

- `country`
- `country-detail`
- `country-details`
- `currency`

The strongest canonical proof is the `country` bundle, which groups:

- `entity_country`
- `cap_list_countries`
- `country_list`
- `country_detail`
- `country_flag_modal`
- `workflow_country`

## Canonical Outputs

Canonical outputs now exist under:

- `./trials/clean-architecture-swiftui/topogram/entities`
- `./trials/clean-architecture-swiftui/topogram/capabilities`
- `./trials/clean-architecture-swiftui/topogram/shapes`
- `./trials/clean-architecture-swiftui/topogram/decisions`
- `./trials/clean-architecture-swiftui/topogram/docs/workflows`
- `./trials/clean-architecture-swiftui/topogram/docs/reports`

Representative promoted files include:

- `entity-country.tg`
- `cap-list-countries.tg`
- `shape-output-list-countries.tg`
- `decision-country.tg`
- `workflow_country.md`
- `ui-country_list.md`
- `ui-country_detail.md`
- `ui-country_flag_modal.md`

## Important Current Boundary

This is a credible iOS proof, but it is still intentionally partial:

- `country-details` remains a workflow-reviewed candidate, not yet a fully adopted canonical bundle
- `currency` and `country-detail` remain as pending supporting bundles
- this proof is SwiftUI-first, not a UIKit proof

That is acceptable for the current milestone because the core goal was to prove that Topogram can recover and adopt a meaningful iOS concept from real Swift code.

## Why This Is Enough To Move Forward

iOS is now a credible confirmed proof for SwiftUI-first brownfield import because Topogram can:

- recover persisted domain concepts from SwiftData
- recover API capabilities from repository code
- recover SwiftUI screens and route-like surfaces
- reconcile those signals into a coherent `country` concept
- promote that concept into canonical Topogram files

## Deferred For iOS v1

- UIKit extraction
- deeper coordinator/navigation extraction
- broader source-only networking patterns beyond the current repository style
- full promotion of the remaining supporting country/currency bundles
