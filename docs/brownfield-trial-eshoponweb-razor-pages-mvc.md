# Brownfield Trial: eShopOnWeb Razor Pages MVC

## Repo

- Trial repo: `./trials/eShopOnWeb`
- Source: `dotnet-architecture/eShopOnWeb`

## What This Trial Proved

This trial confirmed that Topogram can recover a credible server-rendered `.NET` UI surface from a real Razor Pages / MVC app, not just Blazor components.

The proof focused on the `Web` app inside `eShopOnWeb`:

- Razor Pages import from `Pages/**/*.cshtml`
- MVC view import from `Views/**/*.cshtml`
- account/auth and manage surfaces
- basket and order history flows
- admin/catalog page coverage alongside the already-proven Blazor admin surface

It is also a useful regression proof for conservative UI flow recovery:

- the `basket` flow stays grouped as one user-goal surface
- checkout and success screens do not peel off into weak standalone bundles

## Import Coverage

Current Razor support in Topogram covers:

- `ui/razor-pages`
  - Razor Pages route discovery from `@page`
  - MVC view discovery from `.cshtml` paths
  - page/view clustering into coherent UI surfaces
  - basic capability hints from forms, `asp-page`, `asp-controller`, and `asp-action`
  - suppression of partial/layout helper noise

This complements:

- the earlier ASP.NET Core backend/domain proof
- the earlier Blazor admin proof on the same repo

## Imported Domain Surface

Recovered meaningful server-rendered bundles include:

- `basket`
  - `basket`
  - `basket_checkout`
  - `basket_success`
- `order`
  - `order_list`
  - `order_detail`
- `surface-account`
  - `account_login`
  - `account_register`
  - `account_confirm_email`
  - `account_logout_page`
  - account/manage settings pages
- `surface-app`
  - `catalog_home`
  - `privacy`
  - `error`
- `catalog-item`
  - server-rendered admin pages plus the earlier Blazor catalog screens

## Canonical Outputs

Canonical outputs now exist under:

- `./trials/eShopOnWeb/topogram/docs/reports`
- `./trials/eShopOnWeb/topogram/capabilities`
- `./trials/eShopOnWeb/topogram/decisions`
- `./trials/eShopOnWeb/topogram/docs/workflows`

Representative server-rendered UI outputs:

- `./trials/eShopOnWeb/topogram/docs/reports/ui-basket.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-basket_checkout.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-basket_success.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-order_list.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-order_detail.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-account_login.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-account_register.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-catalog_home.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-privacy.md`
- `./trials/eShopOnWeb/topogram/docs/reports/ui-error.md`

## Queue State

The saved queue is here:

- `./trials/eShopOnWeb/topogram/candidates/reconcile/adoption-status.md`

Current state:

- `Applied items: 37`
- `Blocked items: 0`
- `Next Bundle: None`

That makes this a completed Razor Pages / MVC proof.

## Why This Is Valuable

This rounds out the `.NET` UI story:

- ASP.NET Core proof: backend/domain import
- Blazor proof: component-driven admin UI import
- Razor Pages / MVC proof: server-rendered page/view import

Taken together, those proofs show that Topogram’s `.NET` support is not tied to one UI style.

## Deferred For Razor v1

- stronger shape extraction from page models and MVC view models
- deeper binding of page actions to canonical backend capability ids
- more aggressive suppression of framework-only helper/navigation bundles
- richer controller/page-model workflow inference from code-behind
