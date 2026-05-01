# Topogram Grammar

Topogram statements use the shared shape:

```text
kind identifier [from base_identifier] {
  field value
  block_field {
    entry values
  }
}
```

The parser accepts any `kind identifier { ... }` shape. The validator defines the public grammar by statement kind.

## Statement Kinds

| Kind | Required Fields | Purpose |
| --- | --- | --- |
| `term` | `name`, `description`, `status` | Shared vocabulary with aliases and exclusions. |
| `actor` | `name`, `description`, `status` | Human or system participant. |
| `role` | `name`, `description`, `status` | Permission or responsibility grouping. |
| `enum` | `values` | Closed symbol set. |
| `entity` | `name`, `description`, `fields`, `status` | Durable domain object and relations. |
| `shape` | `name`, `description`, `status` | Input/output payload shape, optionally derived from an entity. |
| `rule` | `name`, `description`, `applies_to`, `status` | Policy or invariant linked to model elements. |
| `capability` | `name`, `description`, `status` | User-visible operation over entities and shapes. |
| `component` | `name`, `description`, `props`, `status` | Reusable UI or service contract addressable in the semantic graph. |
| `decision` | `name`, `description`, `status` | Architectural or product decision record. |
| `projection` | `name`, `description`, `platform`, `realizes`, `outputs`, `status` | Platform-specific realization surface. |
| `orchestration` | `name`, `description`, `inputs`, `steps`, `outputs`, `status` | Multi-step process model. |
| `verification` | `name`, `description`, `validates`, `method`, `scenarios`, `status` | Proof target for generated or maintained behavior. |
| `operation` | `name`, `description`, `observes`, `metrics`, `alerts`, `status` | Operational monitoring contract. |

## Components

`component` statements model reusable contracts independent of a target framework:

```text
component component_ui_data_grid {
  name "Data Grid"
  description "Reusable tabular display"
  category collection

  props {
    rows array required
    selected_ids array optional default []
  }

  events {
    row_select shape_output_task_card
  }

  slots {
    toolbar "Toolbar actions"
  }

  patterns [resource_table, data_grid_view]
  regions [results, toolbar]
  version "1.0"
  status active
}
```

Validation enforces supported categories, prop entry shape, event shape references, slot entries, UI pattern and region symbols, and dependency references.

Projection statements bind components to concrete screens and regions:

```text
projection proj_ui_shared {
  # ...
  ui_components {
    screen task_list region results component component_ui_data_grid data rows from cap_list_tasks event row_select navigate task_detail
  }
}
```

Validation enforces known screens, regions, components, component props, component events, and binding targets.

See [Components](./components.md) for generator output and roadmap details.
