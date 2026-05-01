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
| `domain` | `name`, `description`, `status` | Business-domain grouping (FIS, RNF, DrugTrac, etc.) for navigation, ownership, and cross-platform coverage. Identifier prefix `dom_`. |
| `pitch` | `name`, `description`, `status`, `priority` | Shape-the-work artifact: the why and the rough shape of a planned change. Identifier prefix `pitch_`. Lifecycle: draft → shaped → submitted → approved \| rejected. |
| `requirement` | `name`, `description`, `status`, `priority` | Specific commitment that follows from a pitch. Identifier prefix `req_`. Lifecycle: draft → in-review → approved → superseded. |
| `acceptance_criterion` | `name`, `description`, `status`, `requirement` | Testable behavior an agent or human can verify against. Identifier prefix `ac_`. Lifecycle: draft → approved → superseded. |
| `task` | `name`, `description`, `status`, `priority`, `work_type` | Unit of agent or human work. Identifier prefix `task_`. Lifecycle: unclaimed → claimed → in-progress → done (\| blocked). |
| `bug` | `name`, `description`, `status`, `severity`, `priority` | Defect linked to the rule it violates and the verification that proved the fix. Identifier prefix `bug_`. Lifecycle: open → in-progress → fixed → verified \| wont-fix. |

`document` is markdown-only — see [docs/sdlc.md](sdlc.md) and [docs/lifecycles.md](lifecycles.md). Documents live in `topogram/docs/` with extended frontmatter (`app_version`, `audience`, `priority`, `affects`, `satisfies`, `domain`).

## Optional `domain` field

Workhorse spec kinds may carry an optional singular `domain` field that
references a `domain` statement. Use it when a statement belongs to one
business slice; omit it when the statement is cross-cutting:

```text
capability cap_call_feed {
  name "Call Feed"
  description "Daily feed-calling workflow"
  domain dom_rnf
  ...
}
```

Kinds that may carry `domain`: `capability`, `entity`, `rule`,
`verification`, `orchestration`, `operation`, `decision`, `pitch`,
`requirement`, `task`, `bug`. Cross-cutting kinds (`term`, `actor`, `role`,
`enum`, `shape`, `component`, `projection`, `acceptance_criterion`)
cannot. The validator hard-errors on unknown ids and
wrong-kind references.

The resolver populates a `resolvedDomain` pointer on each tagged
statement and a reverse-indexed `members` block on each `domain`. See
[Domains](./domains.md) for the full guide.

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
  dependencies [proj_ui_shared]
  consumers [proj_ui_shared]
  version "1.0"
  status active
}
```

Validation enforces supported categories, prop entry shape, event shape references, slot entries, UI pattern and region symbols, and dependency/consumer references.

See [Components](./components.md) for generator output and roadmap details.
