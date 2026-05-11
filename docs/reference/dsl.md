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
