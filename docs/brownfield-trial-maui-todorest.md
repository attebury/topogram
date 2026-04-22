# Brownfield Trial: MAUI TodoREST

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST`
- Source: `dotnet/maui-samples`

## What This Trial Proved

This trial confirmed that Topogram can recover and adopt a credible MAUI domain surface when a repo combines:

- a .NET backend API
- shared .NET model classes
- MAUI XAML pages and shell navigation

This is a stronger MAUI proof than the earlier `maui-mvvm-sample` baseline because it includes a real API-backed todo flow instead of only local MVVM UI wiring.

## Import Coverage

Current MAUI/.NET support in Topogram covers:

- `db/dotnet-models`
  - plain C# model classes under `Models/`
  - property extraction
- `api/aspnet-core`
  - ASP.NET Core controller discovery
  - attribute-routed CRUD handlers
  - body/path extraction
- `ui/maui-xaml`
  - XAML page discovery
  - shell route discovery
  - button/click handler extraction
  - screen and UI report generation

## Imported Domain Surface

Recovered core bundle:

- `todo-item`

That bundle groups:

- `entity_todo-item`
- `cap_list_todo_items`
- `cap_create_todo_item`
- `cap_update_todo_item`
- `cap_delete_todo_item`
- `todo_list`
- `todo_item`
- `workflow_todo-item`

## Canonical Outputs

Canonical outputs now exist under:

- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/docs/workflows`
- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/docs/reports`

Representative promoted files include:

- `entity-todo-item.tg`
- `cap-list-todo-items.tg`
- `cap-create-todo-item.tg`
- `cap-update-todo-item.tg`
- `cap-delete-todo-item.tg`
- `decision-todo-item.tg`
- `workflow_todo-item.md`
- `ui-todo_list.md`
- `ui-todo_item.md`

## Completion State

The saved queue is now clean:

- `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST/topogram/candidates/reconcile/adoption-status.md`
- `Next Bundle: None`
- `Blocked items: 0`

That makes this a completed curated MAUI proof, not just an importer baseline.

## Why This Is Enough To Move Forward

MAUI is now confirmed enough to move on because Topogram can:

- recover a real .NET entity from shared models
- recover CRUD capabilities from an ASP.NET Core backend in the same solution
- recover MAUI screens and UI review docs from XAML pages
- reconcile those signals into a single `todo-item` domain concept
- promote that concept into canonical Topogram files

## Deferred For MAUI v1

- deeper MVVM command semantics beyond basic click-handler extraction
- richer HttpClient/Refit client-side API extraction
- broader Shell navigation and query-property flow modeling
- more complex multi-feature MAUI apps beyond the focused todo sample
