# Widgets

`widget` is Topogram's reusable semantic UI contract. It is not a React,
Svelte, SwiftUI, or Android component. Generators map widget contracts to their
stack.

## Authoring

```text
widget widget_data_grid {
  name "Data Grid"
  description "Reusable tabular display"
  category collection
  props {
    rows array required
    selected_ids array optional default []
  }
  events {
    row_select shape_output_item_card
  }
  patterns [resource_table, data_grid_view]
  regions [results, toolbar]
  status active
}
```

Place widgets through `widget_bindings` on a `ui_contract` projection:

```text
projection proj_ui_contract {
  type ui_contract
  screens {
    screen item_list title "Items" kind list
  }
  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }
  widget_bindings {
    screen item_list region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail
  }
  status active
}
```

Concrete `web_surface`, `ios_surface`, and `android_surface` projections realize
the shared UI contract. They own routes and surface hints, not widget placement.

## Behavior

Widgets can declare behaviors such as `selection`, `sorting`, `filtering`,
`search`, `pagination`, `bulk_action`, and `keyboard_navigation`. Projection
bindings realize those behaviors by connecting data, events, navigation, and
capabilities.

## Required checks

These command shapes are covered by regression tests:

```bash
topogram emit ui-widget-contract ./topo --widget widget_data_grid
topogram emit widget-conformance-report ./topo --projection proj_web_surface --json
topogram widget check ./topo --projection proj_web_surface
topogram widget behavior ./topo --projection proj_web_surface --widget widget_data_grid --json
topogram query widget-behavior ./topo --projection proj_web_surface --widget widget_data_grid --json
topogram query slice ./topo --widget widget_data_grid
```

Use `--json` for agent packets and `--write --out-dir <dir>` when a report or
contract should be written to disk.

## Generator rule

If a generator accepts a widget pattern, tests should prove it appears in the
normalized contract, generated coverage, or generated app output. Unsupported
widget usage should produce a clear diagnostic; it should not silently disappear.
