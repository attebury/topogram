# Brownfield Trial: eShopOnWeb Blazor

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/eShopOnWeb`
- Source: `dotnet-architecture/eShopOnWeb`

## What This Trial Proved

This trial confirmed that Topogram can recover a credible Blazor UI surface from a real production-style `.NET` repo, then carry that surface through curated adoption.

The proof is intentionally centered on the `BlazorAdmin` app:

- Blazor route/component import from `.razor` pages
- modal CRUD admin surface recovery
- auth/logout surface recovery
- reuse of the existing `.NET` backend/workflow extraction where it was already helpful

## Import Coverage

Current Blazor support in Topogram covers:

- `ui/blazor`
  - `@page` route discovery
  - component screen discovery from `.razor` files
  - companion `.razor.cs` code-behind parsing for capability hints
  - Blazor router/auth shell detection from `App.razor`
  - clustering into promotable UI surfaces

This complements the earlier ASP.NET Core backend proof rather than replacing it.

## Imported Domain Surface

Recovered meaningful bundles include:

- `catalog-item`
  - `catalog_item_list`
  - `catalog_item_create`
  - `catalog_item_edit`
  - `catalog_item_detail`
  - `catalog_item_delete`
- `surface-account`
  - `account_logout`
- `item`
  - backend/workflow companion bundle from existing ASP.NET Core extraction

## Canonical Outputs

Canonical outputs now exist under:

- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/workflows`

Promoted Blazor UI review docs include:

- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports/ui-catalog_item_list.md`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports/ui-catalog_item_create.md`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports/ui-catalog_item_edit.md`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports/ui-catalog_item_detail.md`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports/ui-catalog_item_delete.md`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/reports/ui-account_logout.md`

The saved backend/workflow companion outputs are:

- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/capabilities/cap-list-item.tg`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/capabilities/cap-get-item.tg`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/capabilities/cap-create-item.tg`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/decisions/decision-item.tg`
- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/docs/workflows/workflow_item.md`

## Queue State

The saved queue is here:

- `/Users/attebury/Documents/topogram/trials/eShopOnWeb/topogram/candidates/reconcile/adoption-status.md`

Current state:

- `Applied items: 11`
- `Blocked items: 0`
- `Next Bundle: None`

That makes this a completed Blazor proof rather than a partial baseline.

## Why This Is Valuable

This gives Topogram a real Blazor proof on top of the broader `.NET` foundation:

- ASP.NET Core proof: backend/domain import and adoption
- Blazor proof: component-driven admin UI import and promotion

Together they make the `.NET` story much more complete.

## Deferred For Blazor v1

- deeper form/input shape extraction from Blazor components
- stronger alignment between Blazor service calls and canonical backend capability ids
- richer Razor Pages / MVC view extraction beyond the Blazor app itself
- broader shell/noise suppression for framework-only helper bundles
