# Topogram Model

Topogram separates durable intent from stack realization.

## Source

`topo/` contains `.tg` statements and markdown documents. The parser flattens
the folder tree into one graph, so folders are a human and agent convention.
`topogram init` creates an empty `topo/` workspace for a maintained repo;
`topogram init --with-sdlc` also adopts enforced SDLC; `topogram new` copies a
starter template into a new project.

Common statement kinds:

- `actor`, `role`, `term`, `domain`
- `entity`, `shape`, `enum`
- `rule`, `capability`, `orchestration`, `verification`
- `widget`
- `journey`
- `projection`
- `decision`
- SDLC kinds: `pitch`, `requirement`, `acceptance_criterion`, `task`, `plan`,
  `bug`

## Project Config

`topogram.project.json` declares:

- workspace path, usually `./topo`;
- output ownership, generated or maintained;
- topology runtimes;
- generator bindings;
- runtime relationships such as `uses_api` and `uses_database`;
- ports and stack-specific runtime settings.

## Contracts And Surfaces

Projection `type` describes the contract or surface:

- `ui_contract` owns semantic UI: screens, regions, widget bindings, behavior,
  visibility, navigation, and design tokens.
- `web_surface`, `ios_surface`, and `android_surface` realize a UI contract for
  a concrete platform.
- `api_contract` owns API endpoints and wire contracts.
- `db_contract` owns database tables, columns, relations, indexes, and lifecycle
  intent.
- `cli_surface` owns command-line commands, options, effects, and examples.

## Journeys

`journey` records describe ordered workflows for users, maintainers, and agents.
They use repeated `step { ... }` and `alternate { ... }` blocks so the graph can
preserve sequence, branch points, commands, expected outcomes, and related
capabilities or surfaces.

Canonical journeys are graph-native `.tg` statements. Markdown journey text is
supporting material or an import/reconcile draft until it is reviewed and
promoted into a `journey` record.

## Runtimes

Topology runtimes are deployable or generated units:

- `web_surface`
- `api_service`
- `database`
- `ios_surface`
- `android_surface`

Runtimes bind projections to generators. Generators receive normalized
contracts and write stack-specific output.

## Ownership

Generated outputs can be replaced only when their generated sentinel is present.
Maintained outputs are never overwritten; Topogram can still emit contracts,
reports, checks, and migration proposals for maintained apps.
