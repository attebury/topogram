# SvelteKit realization repo (reference plan)

## Overview

How a Topogram-aligned SvelteKit realization separates **semantic** `widget` / `ui_contract` source in `topo/` from **stack** components in the app, keeps `data-topogram-widget` traceability, and verifies via standard CLI commands ([docs/widgets.md](docs/widgets.md), bundled generator in [engine/src/generator/surfaces/web/sveltekit-widgets.js](engine/src/generator/surfaces/web/sveltekit-widgets.js)).

## Principles (short)

- Intent in `topo/`; Svelte in `apps/web` (or `app/`) implements **normalized** widget contracts.
- Preserve **`data-topogram-widget="<widget_id>"`** and **`data-topogram-region="<region>"`** on wrappers so coverage and agents can correlate DOM to the graph.
- CI: `topogram check`, `topogram widget check`, `svelte-check` / build as appropriate.

### Multiple instances of the same widget on one page

`data-topogram-widget="widget_data_grid"` is the **widget’s id from the graph** (`widget widget_data_grid { ... }`)—it names the **contract/type**, not a unique DOM instance. **Several instances on one page** all repeat the same attribute value, the same way many `<button>`s share the same component type. That is enough for generators and many checks to confirm “this subtree is a Data Grid realization.”

**How to tell instances apart** when tests, agents, or A11y need a narrower target:

- **`data-topogram-region`** — different regions (`results` vs `toolbar`) are already distinct slots in the `ui_contract`.
- **Layout / route context** — scope queries under the screen’s route or a parent `<main>` keyed to the current screen.
- **Optional team convention** — if you need a stable **binding-level** id (e.g. two grids bound to different capabilities), add a second attribute in the Svelte layer only, such as `data-topogram-use="item_list_results"` or `aria-labelledby` tied to a unique heading, without changing the **contract** id on `data-topogram-widget`.

Coverage that greps for a single marker per file still passes when the string appears more than once; tests that need “exactly one” should be written against **binding** or **region**, not against uniqueness of `data-topogram-widget`.

## Illustrative repo layout

```text
example-org-topogram-sveltekit/
  topogram.project.json
  package.json
  topo/
    widgets/widget-data-grid.tg
    projections/proj-ui-contract.tg   # excerpt or full; see fixture
    projections/proj-web-surface.tg
    ...                               # entities, shapes, capabilities as needed
  apps/web/                           # SvelteKit (maintained or generated-owned)
    src/
      lib/widgets/item-card.ts
      lib/widgets/DataGridTopogram.svelte
      routes/items/+page.svelte
      routes/items/+page.ts
```

---

## Team process: choosing SvelteKit, styles, and “normalize all the things”

This section is about **where decisions live** so teams don’t improvise stack choice in README only, and so styling has a **single semantic source** without turning every hex code into graph spam.

### How a team indicates “this project uses SvelteKit”

1. **`topogram.project.json` is the switch**  
   Add (or keep) a topology runtime with `"kind": "web_surface"` and the bundled adapter **`topogram/sveltekit`**. The engine dispatches to the SvelteKit generator from that binding—same pattern as the **`app-basic`** fixture:

   ```json
   {
     "id": "app_sveltekit",
     "kind": "web_surface",
     "projection": "proj_web_surface",
     "generator": { "id": "topogram/sveltekit", "version": "1" },
     "uses_api": "app_api"
   }
   ```

   Reference: [engine/tests/fixtures/workspaces/app-basic/topogram.project.json](engine/tests/fixtures/workspaces/app-basic/topogram.project.json).

2. **`topo/` declares the semantic web surface**  
   A `projection` with `type web_surface` (e.g. `proj_web_surface`) **realizes** the shared `ui_contract` and owns **routes** (`screen_routes`), **`web_hints`**, and links to capabilities. The **UI intent** (screens, widgets, tokens) stays in the **`ui_contract`**; SvelteKit vs React vs vanilla is a **runtime/generator** choice, not a second copy of the product graph.

3. **Org-owned generator**  
   Swap `"generator"` for a package-backed id (e.g. `@acme/generator-sveltekit`) per [docs/authoring/generator-packs.md](docs/authoring/generator-packs.md). Still a `web_surface`; still fed normalized contracts.

**Team habit:** treat “we’re on SvelteKit” as **config + topology**, document it once in CONTRIBUTING, and put **`topogram check`** in CI so a stray runtime edit doesn’t silently desync from `topo/`.

### Styles, colors, and design tokens

1. **Normalize roles and constraints, not every CSS declaration**  
   In the **`ui_contract`**, `design_tokens { ... }` captures **semantic** intent: `density`, `tone`, `radius_scale`, `color_role`, `typography_role`, `action_role`, `accessibility`, etc. (see the full block in [engine/tests/fixtures/workspaces/app-basic/projections/proj-ui-contract.tg](engine/tests/fixtures/workspaces/app-basic/projections/proj-ui-contract.tg)).  
   That is the **portable** layer: school vs startup vs gov can **remap** roles to different palettes without changing widget semantics.

2. **Generated apps**  
   Bundled SvelteKit output derives baseline styling from those tokens (design intent → CSS such as spacing, surfaces, radii—see [engine/src/generator/surfaces/web/design-intent.js](engine/src/generator/surfaces/web/design-intent.js) and `renderDesignIntentCss` usage in the SvelteKit generator). “Correct” here means **emitted CSS matches emitted contract**, not “pretty.”

3. **Maintained apps**  
   The Svelte repo owns **implementation** (`app.css`, Tailwind theme, design system package), but the team should keep a **deliberate mapping**: CSS variables or theme keys that implement the **same roles** the graph declares. When brand changes, you update **mapping + optionally `design_tokens`** if semantics shift (e.g. new destructive affordance). Run **`topogram emit`** / widget checks so drift between **declared** tokens and **built** theme shows up in review, not only in QA’s eyeballs.

4. **What stays stack-local**  
   Class naming, utility frameworks, component library internals, motion—fine, as long as they **don’t contradict** accessibility or role intent checked from `topo/`. The graph answers “**what** we promise”; Svelte answers “**how** we ship it.”

### “Normalize all the things” (only a little true)

**Normalize** when inconsistency would hurt humans *or* agents:

- Widget **patterns** and **behavior** vocabulary ([docs/widgets.md](docs/widgets.md)).
- **Screens, regions, bindings**, navigation—anything that should match across web/native/API consumers.
- **Design token roles** that encode policy (contrast, focus, destructive vs primary).
- **Contracts** (API, DB, CLI) when multiple runtimes depend on them.

**Don’t normalize** for the joke:

- Every pixel, easing curve, or one-off layout unless it’s a **repeated product commitment** (e.g. legal footer always present).
- Third-party component **implementation details** unless they surface as **user-visible contract** (e.g. “keyboard navigation” behavior).

**Rule of thumb:** if two contributors (or two agent runs) would **argue from different assumptions** without a graph fact, put it in `topo/`. If it’s **sugar**, keep it in code behind a stable **semantic** boundary (tokens + widget components).

### Multiple web stacks (e.g. React and SvelteKit)

One **`ui_contract`** stays canonical in `topo/` (screens, widgets, `design_tokens`). **Each stack** gets its own **`web_surface`** projection that **realizes** that contract plus the same capabilities—only routes and hints differ where the product allows. The fixture pair illustrates this: [proj-web-surface.tg](engine/tests/fixtures/workspaces/app-basic/projections/proj-web-surface.tg) vs [proj-web-surface-react.tg](engine/tests/fixtures/workspaces/app-basic/projections/proj-web-surface-react.tg), both listing `proj_ui_contract` under `realizes`.

In **`topogram.project.json`**, add **two** `web_surface` runtimes with **different** `projection` ids and **different** `generator` ids, and point **`outputs`** at two trees (example shapes):

```json
{
  "outputs": {
    "web_svelte": { "path": "./apps/web-svelte", "ownership": "generated" },
    "web_react": { "path": "./apps/web-react", "ownership": "generated" }
  },
  "topology": {
    "runtimes": [
      {
        "id": "app_sveltekit",
        "kind": "web_surface",
        "projection": "proj_web_surface",
        "generator": { "id": "topogram/sveltekit", "version": "1" },
        "uses_api": "app_api"
      }, 
      {
        "id": "app_react",
        "kind": "web_surface",
        "projection": "proj_web_surface_react",
        "generator": { "id": "topogram/react", "version": "1" },
        "uses_api": "app_api"
      }
    ]
  }
}
```

**Implications:**

- **`topogram generate`** (or your CI matrix) runs **per output/runtime** so each app stays in sync with the same graph.
- **`topogram widget check` / `emit widget-conformance-report`** use **`--projection`**; you run them **once per web surface** (e.g. `proj_web_surface` and `proj_web_surface_react`) so each stack proves it still covers the shared widget contracts.
- A **shared npm package** of presentational widgets is still **one package per framework** (Svelte components vs React), or you split by entry points; the **spec** is shared, not the `.svelte` / `.tsx` files.

### Widget UI libraries and CSS: using tokens the graph already names

Yes—if you are building a **SvelteKit widget library** meant to implement Topogram contracts, component CSS should prefer **`var(--topogram-…)`** (and optional fallbacks) so look and feel tracks **`design_tokens`** on the `ui_contract` without hardcoding brand hex in every component.

Bundled generators emit a **`:root` block** from `renderDesignIntentCss` in [engine/src/generator/surfaces/web/design-intent.js](engine/src/generator/surfaces/web/design-intent.js), including **semantic markers** for coverage (e.g. `--topogram-design-density`, `--topogram-design-tone`, `--topogram-design-radius-scale`, role maps like `--topogram-design-color-primary`, plus concrete layout colors such as `--topogram-text-color`, `--topogram-surface-card`, `--topogram-action-primary-background`, `--topogram-focus-outline`, spacing `--topogram-space-unit`, radii `--topogram-radius-card`, etc.).

**Library `DataGrid` styling** can look like this (conceptually):

```css
/* In DataGridTopogram.svelte <style> or a imported .css */
.grid-wrap {
  background: var(--topogram-surface-card, #fff);
  color: var(--topogram-text-color, inherit);
  border: 1px solid var(--topogram-border-color, #e2e8f0);
  border-radius: var(--topogram-radius-card, 12px);
  padding: var(--topogram-space-unit, 1rem);
}
.grid-wrap :global(thead th) {
  font-weight: 600;
}
.grid-wrap :global(tbody tr:focus-visible) {
  outline: var(--topogram-focus-outline, 3px solid #0f5cc0);
}
```

**What the host app must do:**

- **Import** the root theme once: usually the **generated** `app.css` snippet from the same `design_tokens`, or a **maintained** file that **redeclares the same variable names** so `buildDesignIntentCoverage` (marker strings in [design-intent.js](engine/src/generator/surfaces/web/design-intent.js) `requiredDesignMarkers`) still passes for that `ui_contract`.

**Two stacks:** React and SvelteKit apps each ship an **`app.css` (or equivalent)** built from the **same** normalized design intent, so both use **identical `--topogram-*` names**; only component implementations differ. The widget library documents **`peerDependencies`** and “requires `--topogram-*` from host” rather than embedding a second theme system unless you ship a deliberate default theme file for Storybook.

### Integrating an existing open-source SvelteKit design system

Topogram and a third-party design system (Skeleton, shadcn-svelte, Bits UI, Carbon Svelte, etc.) solve **different layers**:

| Layer | Topogram | Design system |
| --- | --- | --- |
| Product shape | `widget`, `ui_contract`, behaviors, bindings | — |
| Primitives and a11y | — | Buttons, tables, dialogs, focus rings, motion |
| Theme | `design_tokens` → semantic roles / `--topogram-*` | Component themes, Tailwind presets, CSS layers |

**Integration is adaptation, not replacement:** keep **`topo/`** as the **semantic** source of truth; implement **widget realizations** as **thin Svelte wrappers** that compose the DS and expose Topogram’s props/events on the boundary.

**1) Wrapper (adapter) components**  
For each `widget` you support, ship e.g. `DataGridTopogram.svelte` that:

- Imports the DS’s table, datagrid, or list primitives (or headless pieces plus your markup).
- Maps **contract props** (`rows`, `selected_ids`, `loading`) to DS props or slots.
- Maps **events** (`row_select` and payload shape) to DS callbacks (`on:click`, `onSelectRow`, etc.).
- Keeps **`data-topogram-widget="…"`** on an outer wrapper for conformance and agents.

Bundled generator HTML is a **scaffold**; in production you **swap the inner implementation** while keeping **graph widget ids** and **`topogram widget check`** stable.

**2) Token bridge**  
`design_tokens` on the `ui_contract` still drive **`--topogram-*`** (see [design-intent.js](engine/src/generator/surfaces/web/design-intent.js)). The DS has its **own** theme. Add a **bridge** stylesheet (or build snippet) that maps Topogram variables to **names the DS consumes**, or maps roles to the DS’s documented theme API. Load order: **DS base → bridge → app**. If the DS is Tailwind-only, maintain a small **role→utility** map for the handful of surfaces your widgets touch.

**3) Repo layout**  
`topo/**` unchanged; `apps/web` depends on the OS DS from npm; **`src/lib/topogram/`** (or a workspace package) holds **adapters + bridge CSS** only. Optional **custom generator pack** emits routes that import those adapters instead of raw tables.

**4) Verification**  
After DS upgrades: **`topogram widget check`**, **`emit widget-conformance-report`**, **`svelte-check`**. Adapter churn is expected on major DS versions; **`topo/`** usually stays put.

**5) Pitfalls**  
Do not model every DS component in `.tg`. Do not vendor the DS into `topo/` (licensing). Do not drop **`data-topogram-widget`** because the DS prefers its own class names.

**6) Spike candidates (evaluate versions vs Svelte / SvelteKit in your repo)**  
None of these are endorsements—pick based on license, a11y audit, and maintenance.

- **Bits UI** ([bits-ui](https://github.com/huntabyte/bits-ui)) — **Headless** primitives; very little visual opinion. Good first spike for **`widget` → wrapper**: you own the DOM, so `data-topogram-widget` and focus/keyboard behavior stay explicit. Often pairs with Tailwind or your own CSS on top of **`--topogram-*`**.
- **Skeleton** ([skeleton](https://github.com/skeletonlabs/skeleton)) — SvelteKit-oriented, **theming** and layout primitives. A **token bridge** from `design_tokens` to Skeleton’s theme variables is a natural experiment if you want a full UI kit rather than only headless pieces.
- **shadcn-svelte** (community port) — **Components live in your repo** after install/copy, so adapters sit next to DS code and refactors are grep-friendly. Heavier setup; good when you want design tokens + DS both **owned** in-app.

For a **minimal “prove the pattern”** integration, start with **headless + your grid markup** (Bits/Melt) or **Skeleton** if you want batteries-included styling. Re-evaluate npm majors before pinning in production.

### Commercial suites (Progress Telerik / Kendo UI class)

**Same integration idea as OSS:** `topo/` stays semantic; **vendor components live in adapter code** in the app (or in a private package), not in `.tg`.

**1) Product / stack reality**  
Progress sells **several stacks** (e.g. **Kendo UI** for React, Vue, Angular, and jQuery; **Telerik UI for Blazor**; other .NET-focused suites). There is **no first-party “Kendo for SvelteKit”** product line comparable to KendoReact—so if your **Topogram `web_surface`** is SvelteKit-only, you either:

- **Switch or add a runtime** that matches what you buy (e.g. **`topogram/react`** + **KendoReact** for the web app that needs the grid), or  
- Use a **supported embedding** path Progress documents for your framework (if any—often **wrappers or custom elements**), accepting integration risk, or  
- **Hypothetical:** a community/third-party **Blazor** generator for Topogram and realize widgets with **Telerik Blazor** components (same adapter pattern, different `web_surface` tool chain).

**2) Adapter layer**  
Implement e.g. `DataGridTopogram.tsx` (React) or `DataGridTopogram.razor` (Blazor) that:

- Configures **Kendo Grid** / **Telerik Grid** (columns, `data`/`DataSource`, selection mode, sorting) from Topogram **widget props** (`rows`, `selected_ids`, `loading`, behaviors).
- Subscribes to vendor **selection / row / change** events and re-emits **`row_select`** payloads matching the graph’s declared shape.
- Wraps the vendor root in a `<div data-topogram-widget="widget_data_grid">` (or equivalent host) so checks and agents still see the contract id. If the component **owns** the outer DOM, you may need a **thin static wrapper** in markup if the vendor library does not let you set attributes on the outermost element.

**3) Theming**  
Kendo/Telerik products usually theme via **SASS / ThemeBuilder / prebuilt swatches**, not the same **`--topogram-*`** pipeline as the bundled Svelte generator. Treat `design_tokens` as **spec**: either:

- Manually map roles **(primary, danger, density)** into the vendor’s theme pipeline when designers change brand direction, or  
- Generate a **small “theme spec” document** from Topogram emit for hand-off to whoever maintains the Kendo theme.

A full automatic `--topogram-*` → Kendo variable sync is **possible but custom**—plan engineering time.

**4) Licensing and supply chain**  
Keep **commercial packages** in the **consumer app** (`package.json` / NuGet), with license keys or private feeds per Progress docs. Do **not** copy vendor source into `topo/` or publish it in a public Topogram template without clearing redistribution.

**5) Verification**  
Still run **`topogram widget check`** and related emits on the **`web_surface`** projection that owns that app. Add **stack tests** (React test renderer, Playwright, bUnit for Blazor) around the adapter because vendor grids have **their own** a11y and keyboard behavior—you are asserting **“contract satisfied”**, not identical DOM to the OSS spike.

---

## iOS / SwiftUI: how design and styles align with Topogram

Web stacks express theme mostly as **CSS** (`--topogram-*` from `renderDesignIntentCss`). **iOS has no CSS**—the same **normalized** intent still comes from **`design_tokens`** on the shared **`ui_contract`**, and the **SwiftUI app** maps those roles to **colors, typography, spacing, and materials**.

### Single source in `topo/`

- **`design_tokens { ... }`** on the `ui_contract` is **platform-neutral** (density, tone, `radius_scale`, `color_role`, `typography_role`, `action_role`, `accessibility`).
- The routed **`ui-surface-contract`** JSON (what the bundled SwiftUI pack places in `Resources/ui-surface-contract.json`) includes a **`designTokens`** object with the same semantic fields—see the **`app-basic`** shape (e.g. `density`, `tone`, `colorRoles`, `typographyRoles`, … in [ui-surface-contract.json](engine/tests/fixtures/expected/app-basic/apps/web/app_sveltekit/src/lib/topogram/ui-surface-contract.json)).

So: **one graph**, **one token object**; web renders CSS variables, iOS renders **Swift types**.

### What “styles” look like on iOS

| Topogram (semantic) | Typical iOS realization |
| --- | --- |
| `density` | `CGFloat` spacing scale, stack padding, content margins |
| `tone` | Grouped vs branded surfaces—**system grouped backgrounds**, materials, or **Asset Catalog** named colors |
| `radiusScale` | Shared corner radii (e.g. `RoundedRectangle`) via a **theme** struct |
| `colorRoles` (e.g. primary → accent) | **AccentColor**, semantic `Color` assets, light/dark variants |
| `typographyRoles` | SwiftUI **`.font`** text styles or registered custom fonts; respect **Dynamic Type** |
| `actionRoles` | **Button** roles (prominent, destructive) |
| `accessibility` | High contrast, **Reduce Motion**, VoiceOver labels on interactive rows |

Implement a **`TopogramTheme`** (or **`DesignTokens`**) type loaded from **`designTokens` in the JSON** at launch, then expose it with **`Environment`** or a view modifier so **widget adapters** and screens use **roles**, not scattered literals.

### Widgets and screens

- **Widget ids** match web (`widget_data_grid`, …). **SwiftUI views** are **adapters** (`List`, `Table`, custom cells)—same pattern as Svelte wrappers.
- **Automation parity:** iOS has no `data-topogram-widget`; use **`accessibilityIdentifier`** (or similar) on the widget container when you need stable UI-test hooks.

### Multi-surface monorepo

- **`topogram.project.json`**: an **`ios_surface`** runtime with **`topogram/swiftui`** (or a package generator), alongside **`web_surface`**, both tied to the **same** `proj_ui_contract`.
- When **`design_tokens`** change, update **web CSS and iOS theme** together; **`context-diff`** / migration tooling can flag token deltas affecting both surfaces.

### Bundled SwiftUI pack (scope today)

The **in-repo SwiftUI templates** emphasize **system-default** styling and contract-driven screens. They do not yet mirror web’s full **`renderDesignIntentCss`** auto-pipeline. **Production** work still treats **`designTokens` in JSON** as authoritative and implements (or generates) **`Theme.swift` + Assets** from that payload—ideally sharing the **same normalization table** as [design-intent.js](engine/src/generator/surfaces/web/design-intent.js) so density/tone/radius math **matches** web unless you intentionally diverge per **HIG**.

---

## Maintained apps (how Topogram fits without overwriting your code)

**Maintained** means: paths declared under **`topogram.project.json`** **`outputs`** use **`"ownership": "maintained"`**. Topogram **must not** replace those trees on `generate`; your **SvelteKit / React / Swift** source stays hand-owned. See [docs/concepts/generate-vs-emit.md](docs/concepts/generate-vs-emit.md) and [AGENTS.md](AGENTS.md) (generated vs maintained ownership).

### What you still do in `topo/`

- Edit **`topo/**`** as the **durable spec**: `ui_contract`, `widgets`, `design_tokens`, `ios_surface` / `web_surface`, API/DB as needed.
- Run **`topogram check`** and (if adopted) **`topogram sdlc gate`** so the graph stays valid.

### What Topogram does for you (no clobbering)

- **`topogram emit …`** — writes or prints **contracts, reports, snapshots, migration/diff context** into allowed paths. Typical maintainer habits:
  - **`emit ui-surface-contract`** (or equivalent) into **`apps/web/src/lib/topogram/`** (or `docs/contracts/`) so agents and reviewers see the **normalized** payload without scraping `.tg` by hand.
  - **`emit widget-conformance-report`**, **`topogram widget check`**, **`query slice`** — prove maintained UI still **matches** bindings for each **`web_surface` / `ios_surface` projection**.
- **`context-diff`** against a baseline when **`design_tokens` or widgets** change—drives a review checklist for **CSS / Theme.swift** updates ([docs/widgets.md](docs/widgets.md) migration guidance).

### How styling and adapters work (same ideas, you own the files)

- **Web:** **`app.css` / Tailwind / DS** live in the maintained app. You add or adjust **`--topogram-*`** (or a bridge to your DS) when `design_tokens` change so **`buildDesignIntentCoverage`**-style checks still see required markers if you run them against your stylesheet path.
- **iOS:** **`Theme.swift` + Asset Catalog** are maintained; reload **`designTokens`** from emitted JSON in CI or at build time and **fail** or open a ticket when parsing breaks after a spec change.
- **Widget realizations** (`DataGridTopogram.svelte`, Swift views) are **your** code forever—Topogram only supplies the **contract id**, **checks**, and **artifacts** that tell you when to edit them.

### Example: production **maintained** web app (styling + adapter + markers)

Illustrative layout ( **`ownership": "maintained"`** for `apps/web` ):

```text
repo/
  topogram.project.json          # outputs.apps_web.path = ./apps/web, ownership maintained
  topo/
    widgets/data-grid.tg         # widget widget_data_grid { ... } (canonical)
    projections/proj-ui-contract.tg   # widget_bindings for item_list / results
    projections/proj-web-surface.tg
  apps/web/
    src/
      app.css                    # :root --topogram-* (theme implements design_tokens)
      lib/topogram/
        ui-surface-contract.json # optional: from `topogram emit ui-surface-contract --write`
      lib/adapters/
        DataGridTopogram.svelte  # production adapter: markers + token-based CSS
    routes/items/+page.svelte    # composes adapter; marks region for tooling
```

**1) Theme (`apps/web/src/app.css`)** — loads once; values track **`design_tokens`** (could be hand-maintained or copied from a one-off emit of design intent):

```css
/* Implements ui_contract design_tokens for this app */
:root {
  --topogram-surface-card: #ffffff;
  --topogram-text-color: #182026;
  --topogram-muted-color: #607284;
  --topogram-border-color: #d1d9e0;
  --topogram-radius-card: 14px;
  --topogram-space-unit: 0.75rem;
  --topogram-control-padding: 0.55rem 0.75rem;
  --topogram-action-primary-background: #0f5cc0;
  --topogram-focus-outline: 3px solid #0f5cc0;
}
```

**2) Adapter (`apps/web/src/lib/adapters/DataGridTopogram.svelte`)** — **your** package or monorepo code; honors widget props/events; **stable marker** for checks:

```svelte
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  export let rows: Record<string, unknown>[] = [];
  export let selectedIds: string[] = [];
  const dispatch = createEventDispatcher<{ rowSelect: { id: string } }>();
</script>

<div
  class="tg-grid"
  data-topogram-widget="widget_data_grid"
  role="region"
  aria-label="Items"
>
  <table>
    <tbody>
      {#each rows as row (String(row.id ?? row.uuid))}
        <tr
          class:selected={selectedIds.includes(String(row.id))}
          on:click={() => dispatch("rowSelect", { id: String(row.id) })}
        >
          <td>{row.title}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .tg-grid {
    background: var(--topogram-surface-card);
    color: var(--topogram-text-color);
    border: 1px solid var(--topogram-border-color);
    border-radius: var(--topogram-radius-card);
    padding: var(--topogram-space-unit);
  }
  .selected {
    outline: var(--topogram-focus-outline);
  }
</style>
```

**3) Screen (`apps/web/src/routes/items/+page.svelte`)** — **region** marker aligns with `screen_regions` / reviews:

```svelte
<script lang="ts">
  import DataGridTopogram from "$lib/adapters/DataGridTopogram.svelte";
  export let data;
</script>

<main>
  <section data-topogram-region="results">
    <DataGridTopogram rows={data.items} selectedIds={data.selectedIds ?? []} />
  </section>
</main>
```

**4) What you run in CI** (from repo root):

```bash
topogram check ./topo --json
topogram emit ui-surface-contract ./topo --projection proj_web_surface --write --out-dir apps/web/src/lib/topogram
topogram widget check ./topo --projection proj_web_surface
```

Nothing here is **engine-owned** except **`check` / `emit`**; **`app.css`**, **`DataGridTopogram.svelte`**, and **routes** are **maintained** and can instead live in **`@acme/topogram-sveltekit-adapters`** published by you.

### `generate` in maintained repos

Use **`topogram generate`** only for outputs that are explicitly **generated-owned** (sentinel present) or after policy review. Otherwise treat **app implementation** as **emit + human/agent edit**, not “regenerate the repo.”

### Brownfield

Existing codebases often use **`topogram extract` / `adopt`** to grow **`topo/`** from legacy sources; once adopted, the same **maintained** loop applies: **spec in `topo/`**, **implementation in app**, **emit/check** to control drift.

#### Widgets and **widget_bindings** after extract

- **Extract** (`topogram extract … --from api,ui` or similar) materializes **review-only** UI artifacts, including:
  - **Widget candidates** (draft `widget` `.tg` under e.g. `topo/candidates/.../widgets/`) and inferred **event payload shapes**.
  - A **draft shared `ui_contract`** at **`topo/candidates/app/ui/drafts/proj-ui-contract.tg`** that can already contain **`screen_regions`** and **`widget_bindings`** lines inferred from the app (see [engine/src/import/core/runner/ui-drafts.js](engine/src/import/core/runner/ui-drafts.js) and tests in [engine/tests/active/import-fixtures.test.js](engine/tests/active/import-fixtures.test.js)).
- **`topogram adopt widgets`** promotes canonical **`topo/widgets/<id>.tg`** and, via plan expansion, related **`shape`** items (event payloads). That is **widget definitions + shapes**, not a separate “bind only” artifact.
- **`topogram adopt ui`** is broader (UI-track reports, flows, **widgets**, and **`ui_widget_event`** shapes); it still follows the **adoption plan**—it does **not** today add a dedicated **`promote_ui_contract_draft`** step that copies the whole draft projection into **`topo/projections/`** automatically (see [engine/src/workflows/reconcile/impacts/adoption-plan.js](engine/src/workflows/reconcile/impacts/adoption-plan.js): **`promote_widget`**, **`promote_ui_report`**, etc.).
- **Practical workflow for mappings:** after adopt, **merge** the drafted **`widget_bindings`** (and any matching **`screen_regions`**) from **`candidates/app/ui/drafts/proj-ui-contract.tg`** into your **canonical** `ui_contract` projection (or rename/replace the draft into `projections/` once capabilities/screens ids line up). Then run **`topogram check`** and **`topogram widget check`**.

So: **yes, extract already proposes widget mappings** in the draft contract; **adopt** handles **widgets (and shapes) into canonical `topo/`**; **binding** those widgets onto your **approved** `ui_contract` is usually a **reviewed merge** step unless/until the tool grows a first-class projection promote for that draft.

#### Should extraction also emit the **widget / style adapter** (stack code)?

**Not into the brownfield source app today—and that is intentional.** [README.md](README.md) states that **`topogram extract` never mutates the source app**; adapters are **implementation**, live in **framework-specific** trees, and depend on **design system / tokens** choices extractors do not reliably know.

**Why adapters stay out of the default extract path:**

1. **Stack variance** — The same `widget_data_grid` might be SvelteKit, React, SwiftUI, or wrapped Telerik/Kendo; a generic emit often **misses** the team’s real abstractions.
2. **Ownership** — **Maintained** apps own application `src/**`; auto-writing adapters from extract would blur **generated vs maintained** boundaries without an explicit, trusted **write scope** ([AGENTS.md](AGENTS.md)).
3. **Workflow** — **Spec first:** after adopt, **`emit`** and **`query slice --widget …`** give agents or humans a **checkable contract**; migrating the **existing** UI to Topogram-aware adapters is a **follow-on migration**, not identical to “read legacy → write Topo.”

**Plausible extensions (product direction, not current default):**

- **Review-only stubs** under the **import `--out`** tree only (e.g. `candidates/scaffolds/**`), never applied to the legacy repo without a second command.
- **`topogram generate`** (or a dedicated emit target) **after** canonical `topo/` + `topogram.project.json` exist, for teams with **generated-owned** app output.
- Agent loop: **extract → adopt → check → slice → implement adapter** in the maintained app under **edit boundaries** from `agent brief`.

**Bottom line:** extraction **should** keep nailing **semantic** `topo/` (widgets, draft bindings, shapes). **Adapters and styling** are **deliberate, stack-specific work**—often assisted by the same graph—so extract stays **safe, non-destructive, and DS-agnostic** to the legacy codebase.

**Recommended pipeline:** **Pass 1** — extract, adopt, merge draft bindings into canonical `ui_contract` as needed, **`topogram check`** (and widget checks). **Pass 2 (optional, explicit)** — **`emit`**, **`query slice`**, then implement or scaffold **adapters + token/theme** (`--topogram-*`, `Theme.swift`, DS bridges) or run **`generate`** only where outputs are **generated-owned** and trusted.

#### Instrumenting maintained code (`data-topogram-widget`, `data-topogram-region`)

After adapters exist, **yes**—teams often want **stable hooks** in **maintained** markup for **`topogram widget check`**, coverage, accessibility automation, and **agent slices**. That insertion is **Pass 2b (optional)** and should stay **explicit** (dry-run first, small PRs).

**Script / codemod (prefer when structure is boring):**

- Best when **one convention** holds: e.g. each Topogram-backed widget is a **single wrapper** component or a known outer `div`; **screen ↔ route** mapping is stable from `web_surface` `screen_routes`.
- Use **AST-aware** tools (Svelte compiler API, Babel, TypeScript transformer, SwiftSyntax) so you don’t break templates/JSX. Output is a **normal diff** for code review and CI.
- **Idempotent** transforms (skip if marker already present; don’t double-wrap).
- Fits **repeatability**: same codemod on many files after a spec change.

**Agent task (prefer when legacy is messy):**

- Best when markup is **irregular**, vendor components **own** the DOM, or there is **no** clear single root—requires judgment about **where** the contract boundary lives.
- Give the agent **`query slice --widget …`**, **`emit ui-widget-contract`**, and **edit boundaries** from **`topogram agent brief`**; require **human review** of every file.
- Higher **variance** and cost; still valuable for **one-off** migrations.

**Hybrid (what many teams will do):** codemod inserts markers on **your** wrapper components only; agent handles **edge routes**; CI runs **`topogram widget check`** (and optional **grep/assert** that each bound screen’s realization includes the expected widget id).

**Product-shaped future:** an emit artifact listing **expected markers per route/binding** would let CI **fail** when maintained code drifts from **adopted** `widget_bindings`—insertion itself can stay **script or agent**; **verification** should be **command-owned** where possible.

---

## Complete example (copy-paste walkthrough)

Below is a **minimal but end-to-end illustration**: one widget (`widget_data_grid`), one screen binding (`item_list` / `results`), a web route (`/items`), and a maintained Svelte component that implements the contract’s props/events at the JS level. Real projects should mirror the richer **`app-basic`** fixture under [engine/tests/fixtures/workspaces/app-basic](engine/tests/fixtures/workspaces/app-basic) for valid graphs.

### 1) `topo/widgets/widget-data-grid.tg`

Use the same widget definition as the fixture (props, events, behaviors, patterns):

```tg
widget widget_data_grid {
  name "Data Grid"
  description "Reusable tabular display for item rows"
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

### 2) `topo/projections/proj-ui-contract.tg` (minimal slice)

Include at least the **screen**, **screen_regions** for `results`, and **widget_bindings** matching the fixture pattern ([proj-ui-contract.tg](engine/tests/fixtures/workspaces/app-basic/projections/proj-ui-contract.tg)):

```tg
projection proj_ui_contract {
  name "Example UI"
  type ui_contract
  realizes [cap_list_items, cap_get_item]

  screens {
    screen item_list kind list title "Items" load cap_list_items item_shape shape_output_item_card detail_capability cap_get_item primary_action cap_create_item empty_title "No items yet" empty_body "Create an item" loading_state skeleton error_state inline
  }

  screen_regions {
    screen item_list region toolbar pattern action_bar placement primary
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail
  }

  navigation {
    screen item_list group main label "Items" order 10 visible true default true
    screen item_detail group main label "Item" visible false breadcrumb item_list
  }

  status active
}
```

(You still need **`cap_list_items`**, **`shape_output_item_card`**, **`entity_item`**, etc., elsewhere in `topo/` for a passing `topogram check`—pull from **app-basic** rather than inventing partial shapes.)

### 3) `topo/projections/proj-web-surface.tg` (route for the list)

```tg
projection proj_web_surface {
  name "Example Web"
  type web_surface
  realizes [proj_ui_contract, cap_list_items, cap_get_item]

  outputs [ui_contract, web_app]

  screen_routes {
    screen item_list path /items
    screen item_detail path /items/:id
  }

  status active
}
```

### 4) `topogram.project.json` (minimal)

```json
{
  "version": "1",
  "workspace": "./topo",
  "outputs": [
    {
      "id": "web",
      "path": "./apps/web",
      "ownership": "maintained"
    }
  ],
  "topology": {
    "runtimes": [
      {
        "id": "web_main",
        "kind": "web_surface",
        "projection": "proj_web_surface",
        "generator": { "id": "topogram/sveltekit" }
      }
    ]
  }
}
```

Adjust `ownership` to `generated` if this app output is CLI-owned with sentinels.

### 5) `apps/web/src/lib/widgets/item-card.ts`

```ts
/** Row shape aligned with shape_output_item_card (fixture rename: dueAt, ownerId) */
export type ItemCardRow = {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  dueAt?: string;
  ownerId: string;
};
```

### 6) `apps/web/src/lib/widgets/DataGridTopogram.svelte`

Implementation **maps semantics** from the widget contract: `rows`, `selected_ids` → `selectedIds`; multi-selection; sort keys aligned with `behaviors.sorting`; emits **`rowSelect`** (event) with card-shaped payloads.

```svelte
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ItemCardRow } from "./item-card.js";

  export let rows: ItemCardRow[] = [];
  export let selectedIds: string[] = [];
  export let loading = false;

  const dispatch = createEventDispatcher<{
    rowSelect: { item: ItemCardRow; selectedIds: string[] };
  }>();

  type SortField = "title" | "status" | "created_at";
  let sortField: SortField = "created_at";
  let sortDir: "asc" | "desc" = "desc";

  $: displayRows = sortRows(rows, sortField, sortDir);

  function sortRows(list: ItemCardRow[], field: SortField, dir: "asc" | "desc") {
    const mul = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = fieldValue(a, field);
      const bv = fieldValue(b, field);
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
  }

  function fieldValue(row: ItemCardRow, field: SortField): string | number {
    if (field === "title") return row.title ?? "";
    if (field === "status") return row.status ?? "";
    return row.dueAt ?? "";
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDir = field === "created_at" ? "desc" : "asc";
    }
  }

  function toggleRow(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    selectedIds = next;
  }

  function onRowClick(item: ItemCardRow) {
    toggleRow(item.id);
    dispatch("rowSelect", { item, selectedIds });
  }
</script>

<div
  class="widget-card widget-table"
  data-topogram-widget="widget_data_grid"
  aria-busy={loading}
>
  <div class="widget-header">
    <p class="widget-eyebrow">Widget</p>
    <h2>Data Grid</h2>
    <span class="badge">{rows.length} items</span>
  </div>

  <div class="table-wrap">
    <table class="resource-table data-grid">
      <thead>
        <tr>
          <th scope="col">
            <button type="button" on:click={() => toggleSort("title")}>
              Title {sortField === "title" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </button>
          </th>
          <th scope="col">
            <button type="button" on:click={() => toggleSort("status")}>
              Status {sortField === "status" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </button>
          </th>
          <th scope="col">Owner</th>
          <th scope="col">
            <button type="button" on:click={() => toggleSort("created_at")}>
              Due {sortField === "created_at" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each displayRows as item (item.id)}
          <tr
            class:selected={selectedIds.includes(item.id)}
            on:click={() => onRowClick(item)}
            on:keypress={(e) => e.key === "Enter" && onRowClick(item)}
            role="button"
            tabindex="0"
          >
            <td>{item.title ?? ""}</td>
            <td>{item.status ?? ""}</td>
            <td>{item.ownerId}</td>
            <td>{item.dueAt ?? ""}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  /* Token-aware presentational shell: assumes host `app.css` defines `--topogram-*`
     from `design_tokens` (see design-intent.js). This is still not a full DS—just
     aligned with the graph so a bridge or generator can own the theme. */
  .widget-card {
    background: var(--topogram-surface-card, #fff);
    color: var(--topogram-text-color, inherit);
    border: 1px solid var(--topogram-border-color, #e2e8f0);
    border-radius: var(--topogram-radius-card, 12px);
    padding: var(--topogram-space-unit, 1rem);
  }
  .widget-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--topogram-space-unit, 1rem);
    margin-bottom: var(--topogram-space-unit, 1rem);
  }
  .widget-eyebrow {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--topogram-muted-color, #607284);
  }
  .widget-header h2 {
    margin: 0;
    flex: 1;
    min-width: 8rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: var(--topogram-control-padding, 0.55rem 0.75rem);
    border-radius: var(--topogram-radius-pill, 999px);
    font-size: 0.8rem;
    background: var(--topogram-surface-subtle, #fbfcfe);
    color: var(--topogram-muted-color, #607284);
    border: 1px solid var(--topogram-border-color, #e2e8f0);
  }
  .table-wrap {
    overflow-x: auto;
    border-radius: var(--topogram-radius-control, 12px);
  }
  .resource-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  .resource-table thead th {
    text-align: left;
    padding: var(--topogram-control-padding, 0.55rem 0.75rem);
    border-bottom: 2px solid var(--topogram-border-color, #e2e8f0);
    color: var(--topogram-muted-color, #607284);
    background: var(--topogram-surface-subtle, #fbfcfe);
  }
  .resource-table tbody td {
    padding: var(--topogram-control-padding, 0.55rem 0.75rem);
    border-bottom: 1px solid var(--topogram-border-color, #e2e8f0);
  }
  .resource-table tbody tr:hover {
    background: var(--topogram-surface-subtle, #fbfcfe);
  }
  .resource-table button {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: var(--topogram-action-primary-background, #0f5cc0);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .resource-table button:focus-visible {
    outline: var(--topogram-focus-outline, 3px solid #0f5cc0);
    outline-offset: 2px;
  }
  .selected {
    outline: var(--topogram-focus-outline, 3px solid #0f5cc0);
    outline-offset: 1px;
    background: var(--topogram-surface-subtle, #fbfcfe);
  }
</style>
```

**Why this still isn’t “a design system”:** it’s a **token-bound** shell so CSS tracks `design_tokens` in `topo/` (via `--topogram-*`). A real DS brings **components, density modes, motion, z-index scales, and a11y-tested patterns**. In production you usually **compose a vendor/OSS kit** inside the widget (see *Integrating an existing open-source SvelteKit design system*) or promote shared rules to a **`$lib/ui/`** package—without moving product promises into random class names.

### 7) `apps/web/src/routes/items/+page.ts` (mock load)

```ts
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  return {
    result: {
      items: [
        {
          id: "1",
          title: "Alpha",
          status: "active",
          priority: "high",
          dueAt: "2026-01-10",
          ownerId: "u1"
        },
        {
          id: "2",
          title: "Beta",
          status: "completed",
          priority: "low",
          dueAt: "2026-01-20",
          ownerId: "u2"
        }
      ]
    }
  };
};
```

### 8) `apps/web/src/routes/items/+page.svelte`

```svelte
<script lang="ts">
  import DataGridTopogram from "$lib/widgets/DataGridTopogram.svelte";
  import { goto } from "$app/navigation";
  import type { ItemCardRow } from "$lib/widgets/item-card.js";

  export let data;

  let selectedIds: string[] = [];

  function handleRowSelect(
    e: CustomEvent<{ item: ItemCardRow; selectedIds: string[] }>
  ) {
    selectedIds = e.detail.selectedIds;
    goto(`/items/${e.detail.item.id}`);
  }
</script>

<main>
  <section class="stack" data-topogram-region="toolbar">
    <h1>Items</h1>
  </section>

  <section class="stack" data-topogram-region="results">
    <DataGridTopogram
      rows={data.result.items}
      bind:selectedIds
      on:rowSelect={handleRowSelect}
    />
  </section>
</main>
```

### 9) Verification commands (from repo root)

```bash
topogram check ./topo --json
topogram emit ui-widget-contract ./topo --widget widget_data_grid --json
topogram widget check ./topo --projection proj_web_surface
topogram query slice ./topo --widget widget_data_grid --json
cd apps/web && npm run check
```

---

## Optional: generator pack manifest (`topogram-generator.json`)

If this repo **is** the reusable realization package:

```json
{
  "id": "@example/generator-sveltekit-widgets",
  "version": "1",
  "surface": "web",
  "projectionTypes": ["web_surface"],
  "inputs": ["ui-surface-contract", "api-contracts"],
  "outputs": ["web-app", "generation-coverage"],
  "stack": {
    "runtime": "browser",
    "framework": "sveltekit",
    "language": "typescript"
  },
  "capabilities": {
    "routes": true,
    "widgets": true,
    "coverage": true
  },
  "widgetSupport": {
    "patterns": ["resource_table", "data_grid_view"],
    "behaviors": ["selection", "sorting"],
    "unsupported": "warning"
  },
  "source": "package",
  "package": "@example/generator-sveltekit-widgets"
}
```

---

## Scope note

Bundled **`topogram/sveltekit`** still emits a **simple HTML table** for `data_grid_view` in-repo; a “production” realization replaces that with richer behavior (virtualization, full a11y, keyboard model) while keeping the **same widget id and markers**. The **complete example** above shows the **maintained-component** pattern that survives those upgrades.
