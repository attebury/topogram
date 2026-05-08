# Widgets

`widget` is a first-class Topogram statement for reusable UI or service contracts. Widgets are platform-neutral: projections can realize screens and outputs, while widgets describe reusable pieces those surfaces depend on.

## Authoring

Use the `widget_<slug>` identifier convention for reusable widgets:

```text
widget widget_data_grid {
  name "Data Grid"
  description "Reusable tabular display"
  category collection

  props {
    rows array required
    selected_ids array optional default []
    loading boolean optional default false
  }

  events {
    row_select shape_output_item_card
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
  bulk_action actions [cap_export_items] state selected_ids emits export_request
}
```

Supported behavior kinds are `selection`, `sorting`, `filtering`, `search`,
`pagination`, `grouping`, `drag_drop`, `inline_edit`, `bulk_action`,
`optimistic_update`, `realtime_update`, and `keyboard_navigation`.

`emits` always references widget events. `actions` and `submit` may reference
either widget events or capabilities. Prefer capability ids when the behavior
is meant to invoke a domain command/query; the projection usage still binds the
concrete widget event to that capability with
`event <widget_event> action <capability>`.

Widget behavior is declared on the widget, but realized by shared
projection usage. In v1, semantic UI ownership belongs only on `ui_contract`
projections: screens, regions, app shell, navigation, collection behavior,
actions, visibility, lookups, widget placement, and design intent. Concrete
`web_surface`, iOS, and Android surfaces may define routes and surface hints, but
they realize the shared projection and inherit widget wiring. This keeps one
reusable widget contract from splintering into stack-specific copies.

A shared projection `widget_bindings` entry supplies concrete data bindings and
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

### Semantic Design Intent

Topogram models semantic UI intent, not framework trees, CSS classes, Tailwind
tokens, or SwiftUI modifiers. Shared UI projections may declare `design_tokens`
tokens such as `density`, `tone`, `color_role`, `typography_role`,
`radius_scale`, `action_role`, and `accessibility`. Concrete web/native
contracts inherit those tokens through `realizes`; generators map them to
framework styling however their stack requires.

Use this only for cross-stack intent that must survive React, SvelteKit, and
native realization. Put concrete styles in generator packs, templates, or
maintained app code.

### Widget-First Workflow

For UI work, treat the shared widget contract as the source of truth:

1. Define or edit the `widget` statement.
2. Bind it to shared screens and regions with `widget_bindings` on `ui_contract`.
3. Keep route declarations and stack hints on concrete web/native projections.
4. Run `topogram check`.
5. Run `topogram widget check --projection <concrete-projection>`.
6. Run `topogram widget behavior --projection <concrete-projection>`.
7. Generate the app or the focused `ui-surface-contract`/widget artifacts.

This is the parity rule for UI: screens, regions, widget placements,
behavior realizations, and semantic design intent must survive validation,
normalized contracts, agent packets, generator coverage, and app compile. If a
generator cannot realize a supported widget pattern, it should emit a clear
diagnostic or fail rather than silently dropping the widget.

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

- `category` is a known widget category.
- `props` entries use `<name> <type> <required|optional> [default <value>]`.
- `events` entries reference existing `shape` statements.
- `slots` entries have a symbol name and text description.
- `behavior` and `behaviors` use the supported interaction vocabulary.
- Structured behavior entries reference existing widget props/events where
  applicable. Action-like behavior entries reference either declared widget
  events or existing capabilities.
- `patterns` and `regions` use the shared UI vocabulary.
- `dependencies` reference existing statements.

## Generated Contract

Generate one widget contract:

```bash
topogram generate ./topogram --generate ui-widget-contract --widget widget_data_grid
```

Generate all widget contracts:

```bash
topogram generate ./topogram --generate ui-widget-contract
```

Passing `--widget <id>` for a missing id is now a hard error rather than a silent `null` artifact, so typos surface immediately.

The JSON artifact contains stable `props`, `events`, `slots`, `behavior`,
`behaviors`, `patterns`, `regions`, and `dependencies` arrays for downstream
tools.

## Conformance Report

Generate a widget conformance report for one projection:

```bash
topogram generate ./topogram --generate widget-conformance-report --projection proj_web_surface --json
```

For day-to-day validation, use the friendlier command alias:

```bash
topogram widget check ./topogram --projection proj_web_surface
```

Optionally narrow the report to one widget:

```bash
topogram generate ./topogram --generate widget-conformance-report --projection proj_web_surface --widget widget_data_grid --json
```

The report checks `projection.widget_bindings` usage against widget contracts,
including required prop bindings, event bindings, navigation targets, action
capability context, widget status, and structured behavior references.
Concrete web projections include inherited widget usage from shared UI
projections, so agents can inspect the surface they are editing without
guessing where the widget was declared.

The JSON artifact includes `projection_usages`, `checks`,
`widget_contracts`, `write_scope`, and `impact` sections. Use `--write` with
`--out-dir <dir>` to write the report to disk; without `--write`, explicit
artifact generation prints JSON and does not create an app bundle.

`topogram widget check` prints a human summary by default, exits non-zero
when conformance errors are present, and emits the same report artifact with
`--json`.

## Behavior Report

Use the behavior report when an agent needs a focused packet for widget
interactions rather than the full conformance report:

```bash
topogram widget behavior ./topogram --projection proj_web_surface
topogram widget behavior ./topogram --projection proj_web_surface --widget widget_data_grid --json
topogram query widget-behavior ./topogram --projection proj_web_surface --widget widget_data_grid --json
```

The equivalent artifact target is:

```bash
topogram generate ./topogram --generate widget-behavior-report --projection proj_web_surface --json
```

The JSON artifact groups behavior realizations by widget, screen,
capability, and effect type. It highlights partial behavior and unbound
behavior events/actions so an agent can move directly from Topogram intent to
the projection wiring that needs attention. Like `widget check`, it exits
non-zero only when conformance errors are present and does not write app output
unless the explicit artifact target is passed with `--write`.

## Projection Usage

Shared UI projections own widget placement and wiring. Use `widget_bindings`
on `type ui_contract` to bind a reusable widget to a screen region, data
source, and event outcome:

```text
projection proj_ui_contract {
  # ...

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail
  }
}
```

`topogram check` validates that the screen and region exist, the widget
exists, the widget supports the region and region pattern when it declares
constraints, `data` bindings reference known widget props and Topogram
sources, and `event` bindings reference known widget events. Concrete
surface projections that declare semantic UI blocks directly fail validation in
v1; they should realize the shared UI projection instead. Concrete projections
own `screen_routes` and stack surface hints only.

Generated UI contracts include the same usage metadata. Each screen gets a
`widgets` array with placement, data bindings, and event bindings, and the
contract includes a top-level `widgets` map for the referenced widget
contracts. Concrete web projections inherit widget usage from shared UI
projections they realize.

Each usage also includes `behaviorRealizations`, the projection-specific bridge
between widget behavior declarations and concrete data/event/effect wiring.
If a behavior declares `emits row_select` but the projection does not bind
`event row_select navigate <screen>` or `event row_select action <capability>`,
the realization is `partial` and `widget-conformance-report` emits a warning.
If a behavior declares `actions [cap_export_items]`, the realization includes a
command effect for that capability and remains `partial` until a projection
usage binds a widget event to `cap_export_items`.

SvelteKit and React generation can consume supported `widget_bindings` bindings.
Every web generator should be contract-complete by default: the Topogram
contract defines the route surface, and template implementation code may replace
generated files but must not define which screens exist. For SvelteKit, the
engine generates pages for routed screens first, then lets the template
implementation override specific route files. Generator-owned pages render
widget regions before falling back to sample list markup. Supported patterns
render widget-marked markup for `summary_stats`, `resource_table`,
`data_grid_view`, `board_view`, and `calendar_view`.

Generated SvelteKit and React apps include a coverage artifact at
`src/lib/topogram/generation-coverage.json`. It records every routed screen,
whether the page came from the implementation provider or the generic generator,
the resolved widget pattern, whether the generator supports it, and an explicit
per-usage status such as `rendered`, `unsupported`, `failed`, or
`implementation_owned`. Generator-owned pages fail generation when a declared
widget usage is unsupported or does not produce widget-marked markup. Treat
warnings in that file as places where implementation-owned UI has projection
intent that the generator could not prove from markers.

Template implementations can call the packaged helpers directly when they need
custom route structure:

```js
import { renderSvelteKitWidgetRegion } from "@topogram/cli/template-helpers/sveltekit.js";
import { renderReactWidgetRegion } from "@topogram/cli/template-helpers/react.js";
```

Vanilla web still emits widget usage in contracts only. Its concrete
widget rendering is intentionally not implemented yet.

## Query Integration

`--widget <id>` is a first-class selector across the agent-facing query family. Examples:

```bash
topogram query slice ./topogram --widget widget_data_grid
topogram query verification-targets ./topogram --widget widget_data_grid
topogram query widget-behavior ./topogram --projection proj_web_surface --widget widget_data_grid --json
topogram query change-plan ./topogram --widget widget_data_grid
topogram query review-packet ./topogram --widget widget_data_grid --from-topogram ../baseline/topogram
```

The slice returns a `context_slice` artifact with `focus.kind === "widget"`,
the widget's referenced shapes, the projections that use it through
`widget_bindings` or matching `patterns`/`regions`, the verifications that target
any of those, and a `review_boundary` of
`{ automation_class: "review_required", reasons: ["widget_surface"] }`.
Widget and UI projection slices also include `ui_agent_packet`, a compact
agent-facing packet with shared ownership rules, widget usage bindings,
resolved screen/region pattern context, semantic design intent, inherited
concrete projections, and the required UI gates: `topogram check`, `topogram widget check`, and
`topogram widget behavior`.

`context-diff` now emits a `widgets` section and folds widget changes into `affected_generated_surfaces.projections`, so `change-plan`, `review-packet`, and `verification-targets` (with `--from-topogram <path>`) automatically pick up widget impacts and recommend `ui-widget-contract` regeneration for the affected ids. When `widget-behavior-report` is recommended, `resolved-workflow-context` and `single-agent-plan` include the matching behavior report artifact and a `topogram query widget-behavior ... --json` command in `recommended_artifact_queries`.

## Roadmap

Likely follow-ups are a `query widget-impact <widget-id>` family for inverse impact analysis, widget coverage scoring, and widget migration planning.

Widget packs are expected to use the existing pure Topogram catalog path described in [Catalog](./catalog.md), for example:

```text
@scope/topogram-widget-data-grid/
  topogram-widget.json
  topogram/
    widgets/widget-data-grid.tg
    shapes/shape-event-row-click.tg
```

A future `topogram widget check` command can mirror `topogram template check` for widget pack authors.
