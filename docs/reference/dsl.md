# DSL Reference

Topogram files use `.tg` statements:

```text
kind identifier {
  field value
  block_field {
    entry values
  }
}
```

The parser accepts generic statement syntax. The validator defines the public
grammar.

## Statement kinds

- `term`
- `actor`
- `role`
- `enum`
- `entity`
- `shape`
- `rule`
- `capability`
- `widget`
- `journey`
- `decision`
- `projection`
- `orchestration`
- `verification`
- `operation`
- `domain`
- `pitch`
- `requirement`
- `acceptance_criterion`
- `task`
- `plan`
- `bug`

Documents are markdown files with frontmatter under `topo/docs/**`.

## Projection types

- `ui_contract`
- `web_surface`
- `ios_surface`
- `android_surface`
- `api_contract`
- `db_contract`
- `cli_surface`

## UI ownership

`ui_contract` owns semantic UI blocks:

- `screens`
- `screen_regions`
- `navigation`
- `app_shell`
- `collection_views`
- `screen_actions`
- `visibility_rules`
- `field_lookups`
- `widget_bindings`
- `design_tokens`

Concrete surfaces own routes and hints:

- `screen_routes`
- `web_hints`
- `ios_hints`

## API blocks

`api_contract` projections use blocks such as `endpoints`, `wire_fields`,
`responses`, `error_responses`, `preconditions`, `idempotency`, `cache`,
`delete_semantics`, `async_jobs`, `async_status`, `downloads`,
`authorization`, and `callbacks`.

## DB blocks

`db_contract` projections use `tables`, `columns`, `keys`, `indexes`,
`relations`, and `lifecycle`.

## CLI surface blocks

`cli_surface` projections use `commands`, `command_options`, `command_outputs`,
`command_effects`, and `command_examples`.

Allowed command effects are `read_only`, `writes_workspace`, `writes_app`,
`network`, `package_install`, `git`, and `filesystem`.

## Journeys

`journey` statements model ordered user, maintainer, or agent workflows as graph
source. Canonical journeys live in `.tg` files, usually under `topo/journeys/`.
Markdown journey documents are transitional/supporting drafts produced by import
or reconcile workflows; promote durable journeys into graph-native `journey`
records.

Required fields:

- `name`
- `description`
- `status`
- `actors`
- `goal`
- at least one `step { ... }`

Allowed statuses are `draft`, `canonical`, `active`, and `deprecated`.

Relationship fields may include `domain`, `roles`, `related_capabilities`,
`related_rules`, `related_projections`, `related_widgets`,
`related_verifications`, `related_decisions`, and `related_docs`.

Journey steps and alternates use repeated ordered record blocks. The parser
syntax is the normal block syntax; validators preserve source order and enforce
known record fields.

```tg
journey journey_greenfield_start_from_template {
  name "Greenfield Start From Template"
  description "A developer starts a new app from a template."
  status canonical
  domain dom_catalog_templates
  actors [actor_consumer_developer]
  goal "Create a valid generated app from a copied Topogram starter."

  step {
    id inspect_templates
    intent "Find available templates."
    commands ["topogram template list --json"]
    expects ["Template aliases and package-backed entries are visible."]
  }

  step {
    id create_project
    intent "Copy the selected template into a project."
    after [inspect_templates]
    commands ["topogram copy hello-web ./my-app"]
    expects ["Project contains topo/, topogram.project.json, README.md, and AGENTS.md."]
  }

  alternate {
    id use_package_spec
    from inspect_templates
    condition "The desired template is not in the catalog."
    commands ["topogram copy @topogram/template-hello-web ./my-app"]
  }
}
```

`step` records support `id`, `intent`, `after`, `commands`, `expects`, and
`notes`. `alternate` records support `id`, `from`, `condition`, `commands`,
`expects`, and `notes`. Step IDs must be unique, `after` must reference existing
steps, and `alternate.from` must reference an existing step.
