# Components

`component` is a first-class Topogram statement for reusable UI or service contracts. Components are platform-neutral: projections can realize screens and outputs, while components describe reusable pieces those surfaces depend on.

## Authoring

Use the `component_<slug>` identifier convention for reusable components:

```text
component component_ui_data_grid {
  name "Data Grid"
  description "Reusable tabular display"
  category collection

  props {
    rows array required
    selected_ids array optional default []
    loading boolean optional default false
  }

  events {
    row_select shape_output_task_card
  }

  slots {
    toolbar "Toolbar actions"
    empty_state "Empty-state content"
  }

  behavior [selection, sorting]
  behaviors {
    selection mode multi state selected_ids emits row_select
    sorting fields [title, status, created_at] default [created_at, desc]
  }
  patterns [resource_table, data_grid_view]
  regions [results, toolbar]
  version "1.0"
  status active
}
```

Required fields are `name`, `description`, `props`, and `status`. Optional fields include `category`, `events`, `slots`, `behavior`, `behaviors`, `patterns`, `regions`, `lookups`, `dependencies`, `version`, and `approvals`.

### Behaviors

`behavior [selection, sorting]` is shorthand for supported interaction
capabilities. `behaviors { ... }` carries details that agents and generators
should not infer:

```text
behaviors {
  selection mode multi state selected_ids emits row_select
  sorting fields [title, status, created_at] default [created_at, desc]
  pagination mode cursor page_size 25
  bulk_action actions [cap_export_tasks] state selected_ids emits export_request
}
```

Supported behavior kinds are `selection`, `sorting`, `filtering`, `search`,
`pagination`, `grouping`, `drag_drop`, `inline_edit`, `bulk_action`,
`optimistic_update`, `realtime_update`, and `keyboard_navigation`.

`emits` always references component events. `actions` and `submit` may reference
either component events or capabilities. Prefer capability ids when the behavior
is meant to invoke a domain command/query; the projection usage still binds the
concrete component event to that capability with
`event <component_event> action <capability>`.

Component behavior is declared on the component, but realized by projection
usage. A projection `ui_components` entry supplies concrete data bindings and
event outcomes. Topogram derives a normalized behavior realization for each
usage:

- `dataDependencies` lists the prop/source bindings available to the behavior.
- `state` records the behavior state prop, whether it is bound by the
  projection, and its default value.
- `emits` records each behavior-emitted event and whether the projection binds
  it.
- `actions` records action/submit directive events or capabilities and whether
  the projection binds them.
- `effects` records concrete outcomes from bound events, using `navigation` for
  screen transitions and `command` for capability actions.
- `status` is `declared`, `realized`, or `partial`.

This keeps behavior spec-driven: generators and agents consume the same
normalized contract rather than inferring behavior from SvelteKit, React, or
template implementation files.

### Prop defaults

Each prop is `<name> <type> <required|optional> [default <literal>]`. Supported `default` literal forms are:

| Literal | Type emitted in the contract |
|---|---|
| `default true` / `default false` | boolean |
| `default null` | `null` |
| `default 0`, `default -3`, `default 42` | integer |
| `default 1.5`, `default -0.25` | number |
| `default "All"` | string |
| `default []` | empty array |
| `default [a, b]` | array of literals (recursively parsed) |

Bare unquoted symbols other than `true`, `false`, `null`, and numerics are passed through as strings.

## Validation

`topogram check` validates:

- `category` is a known component category.
- `props` entries use `<name> <type> <required|optional> [default <value>]`.
- `events` entries reference existing `shape` statements.
- `slots` entries have a symbol name and text description.
- `behavior` and `behaviors` use the supported interaction vocabulary.
- Structured behavior entries reference existing component props/events where
  applicable. Action-like behavior entries reference either declared component
  events or existing capabilities.
- `patterns` and `regions` use the shared UI vocabulary.
- `dependencies` reference existing statements.

## Generated Contract

Generate one component contract:

```bash
topogram generate ./topogram --generate ui-component-contract --component component_ui_data_grid
```

Generate all component contracts:

```bash
topogram generate ./topogram --generate ui-component-contract
```

Passing `--component <id>` for a missing id is now a hard error rather than a silent `null` artifact, so typos surface immediately.

The JSON artifact contains stable `props`, `events`, `slots`, `behavior`,
`behaviors`, `patterns`, `regions`, and `dependencies` arrays for downstream
tools.

## Conformance Report

Generate a component conformance report for one projection:

```bash
topogram generate ./topogram --generate component-conformance-report --projection proj_ui_web --json
```

For day-to-day validation, use the friendlier command alias:

```bash
topogram component check ./topogram --projection proj_ui_web
```

Optionally narrow the report to one component:

```bash
topogram generate ./topogram --generate component-conformance-report --projection proj_ui_web --component component_ui_data_grid --json
```

The report checks `projection.ui_components` usage against component contracts,
including required prop bindings, event bindings, navigation targets, action
capability context, component status, and structured behavior references.
Concrete web projections include inherited component usage from shared UI
projections, so agents can inspect the surface they are editing without
guessing where the component was declared.

The JSON artifact includes `projection_usages`, `checks`,
`component_contracts`, `write_scope`, and `impact` sections. Use `--write` with
`--out-dir <dir>` to write the report to disk; without `--write`, explicit
artifact generation prints JSON and does not create an app bundle.

`topogram component check` prints a human summary by default, exits non-zero
when conformance errors are present, and emits the same report artifact with
`--json`.

## Projection Usage

Projections own component placement and wiring. Use `ui_components` to bind a reusable component to a screen region, data source, and event outcome:

```text
projection proj_ui_shared {
  # ...

  ui_screen_regions {
    screen task_list region results pattern resource_table placement primary
  }

  ui_components {
    screen task_list region results component component_ui_data_grid data rows from cap_list_tasks event row_select navigate task_detail
  }
}
```

`topogram check` validates that the screen and region exist, the component exists, `data` bindings reference known component props and Topogram sources, and `event` bindings reference known component events.

Generated UI contracts include the same usage metadata. Each screen gets a
`components` array with placement, data bindings, and event bindings, and the
contract includes a top-level `components` map for the referenced component
contracts. Concrete web projections inherit component usage from shared UI
projections they realize.

Each usage also includes `behaviorRealizations`, the projection-specific bridge
between component behavior declarations and concrete data/event/effect wiring.
If a behavior declares `emits row_select` but the projection does not bind
`event row_select navigate <screen>` or `event row_select action <capability>`,
the realization is `partial` and `component-conformance-report` emits a warning.
If a behavior declares `actions [cap_export_tasks]`, the realization includes a
command effect for that capability and remains `partial` until a projection
usage binds a component event to `cap_export_tasks`.

SvelteKit and React generation can consume supported `ui_components` bindings.
Every web generator should be contract-complete by default: the Topogram
contract defines the route surface, and template implementation code may replace
generated files but must not define which screens exist. For SvelteKit, the
engine generates pages for routed screens first, then lets the template
implementation override specific route files. Generator-owned pages render
component regions before falling back to sample list markup. Supported patterns
render component-marked markup for `summary_stats`, `resource_table`,
`data_grid_view`, `board_view`, and `calendar_view`.

Generated SvelteKit and React apps include a coverage artifact at
`src/lib/topogram/generation-coverage.json`. It records every routed screen,
whether the page came from the implementation provider or the generic generator,
and whether each `ui_components` usage produced component-marked markup. Treat
warnings in that file as places where projection intent exists but generated UI
did not fully realize it.

Template implementations can call the packaged helpers directly when they need
custom route structure:

```js
import { renderSvelteKitComponentRegion } from "@attebury/topogram/template-helpers/sveltekit.js";
import { renderReactComponentRegion } from "@attebury/topogram/template-helpers/react.js";
```

Vanilla web still emits component usage in contracts only. Its concrete
component rendering is intentionally not implemented yet.

## Query Integration

`--component <id>` is a first-class selector across the agent-facing query family. Examples:

```bash
topogram query slice ./topogram --component component_ui_data_grid
topogram query verification-targets ./topogram --component component_ui_data_grid
topogram query change-plan ./topogram --component component_ui_data_grid
topogram query review-packet ./topogram --component component_ui_data_grid --from-topogram ../baseline/topogram
```

The slice returns a `context_slice` artifact with `focus.kind === "component"`, the component's referenced shapes, the projections that use it through `ui_components` or matching `patterns`/`regions`, the verifications that target any of those, and a `review_boundary` of `{ automation_class: "review_required", reasons: ["component_surface"] }`.

`context-diff` now emits a `components` section and folds component changes into `affected_generated_surfaces.projections`, so `change-plan`, `review-packet`, and `verification-targets` (with `--from-topogram <path>`) automatically pick up component impacts and recommend `ui-component-contract` regeneration for the affected ids.

## Roadmap

Likely follow-ups are a `query component-impact <component-id>` family for inverse impact analysis, component coverage scoring, and component migration planning.

Component packs are expected to use the existing pure Topogram catalog path described in [Catalog](./catalog.md), for example:

```text
@scope/topogram-component-data-grid/
  topogram-component.json
  topogram/
    components/component-ui-data-grid.tg
    shapes/shape-event-row-click.tg
```

A future `topogram component check` command can mirror `topogram template check` for component pack authors.
