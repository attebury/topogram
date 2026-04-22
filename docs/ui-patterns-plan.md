# UI Patterns Plan

This note captures a proposed next step for improving Topogram UI references without prematurely turning Topogram into a full design-system DSL.

## Summary

Recommended direction:

- use a hybrid approach
- keep concrete implementation components implementation-side first
- promote only a small, stable semantic `ui_patterns` vocabulary into canonical Topogram surfaces once it stabilizes
- let each projection assemble those patterns as appropriate for its target

The key idea is:

- Topogram owns what a screen is made of semantically through `ui_patterns`
- implementation references own how those semantics render on a concrete target

This should improve agent guidance by introducing a reusable middle layer between today's screen semantics and today's handwritten page renderers.

This same layer should also become a strong home for:

- recommendations about good default screen composition
- efficient Topogram-to-Topogram UI reuse

## Why this instead of a bigger UI survey first

Topogram already has a broad UI survey corpus and a meaningful shared UI vocabulary.

The current weakness is not lack of survey breadth. The bigger gap is that the system still jumps too directly from:

- screen semantics
- routes and actions
- states, visibility, lookups, and collections

to example-specific page renderers.

That leaves agents with too much freedom in how to compose the final UI. A `ui_patterns` layer can constrain that more effectively than another broad survey pass right now.

Follow-up survey work should still happen, but later and more narrowly, to validate:

- missing pattern names
- region and pattern frequencies
- desktop/mobile distinctions worth promoting into shared semantics

## Recommended architecture

### 1. Keep canonical Topogram focused on semantic UI patterns

Use `ui_shared` to describe reusable UI intent, not framework components.

Examples:

- `action_bar`
- `resource_table`
- `resource_cards`
- `detail_panel`
- `activity_feed`
- `summary_stats`
- `lookup_form`
- `empty_state_panel`
- `inspector_pane`

Topogram should describe what appears on a screen and how regions are composed semantically. It should not initially name React, Svelte, iOS, or Android component implementations.

### 2. Add a composition artifact between UI contract and renderer code

Add a normalized screen-composition layer to UI realization output. This should sit between the current screen contract and the final target renderer.

Example shape:

```json
{
  "screenId": "task_list",
  "composition": [
    { "region": "hero", "pattern": "summary_stats" },
    { "region": "toolbar", "pattern": "action_bar" },
    { "region": "results", "pattern": "resource_table" },
    { "region": "empty", "pattern": "empty_state_panel" }
  ]
}
```

This artifact should be derived from existing screen semantics where possible:

- `ui_screen_regions`
- screen kind
- `ui_collections`
- screen states
- selected `ui_web` presentation refinements

### 3. Keep concrete implementation components in implementation references first

The implementation side should own target-specific pattern registries and composition details.

For web, that means implementation-owned mappings such as:

- `resource_table` -> table or grid renderer
- `detail_panel` -> detail layout renderer
- `action_bar` -> toolbar/filter/action renderer
- `lookup_form` -> target-specific form renderer

This layer can define:

- slots
- props
- layout decisions
- target-specific fallbacks
- mobile/desktop rendering differences

without making those details part of the canonical `.tg` surface yet.

### 4. Use the same layer for recommendations

`ui_patterns` should become the natural place for recommendation logic.

That means Topogram can eventually say not just:

- this is a list screen
- this screen has filters, pagination, and primary actions

but also:

- recommended composition is `action_bar + resource_table + empty_state_panel`
- recommended mobile fallback is `resource_cards`
- recommended supporting region is `summary_stats` when grouped metrics are present

This is more actionable than survey notes alone and more flexible than hard-coding a design system.

### 5. Use the same layer for Topogram-to-Topogram reuse

`ui_patterns` should also make importing other Topograms more efficient.

Imported Topograms should be able to share:

- semantic screen composition
- recommended pattern bundles
- target refinements at the pattern level

without forcing reuse of framework-specific implementation components.

That enables flows such as:

- adopt imported UI semantics but map them to local renderers
- keep imported pattern composition while swapping presentation variants
- share reusable UI guidance across Topogram packages

## Ownership model

### Canonical Topogram owns

- semantic `ui_patterns` vocabulary
- region-level composition intent
- screen semantics
- actions, lookups, states, collections, and visibility rules
- recommendation metadata once it stabilizes

### Implementation references own

- concrete implementation component registries
- target-specific pattern renderers
- slot and prop contracts
- visual/layout choices for specific targets

### Projections own

- choosing and assembling semantic patterns
- refining presentation per target where needed
- deciding how a shared semantic screen maps into a web/mobile/desktop realization

This keeps the durable model light while still giving agents a bounded assembly model.

## Brownfield import direction

Brownfield imports should treat implementation components as evidence, not canonical truth.

The import pipeline should:

- extract repeated component structure from apps as evidence
- normalize that evidence into semantic `ui_patterns`
- emit reviewable candidate composition artifacts under `candidates/app/ui/`
- keep target-specific component mappings advisory and implementation-side

So the practical rule is:

- brownfield import recovers what the UI is made of
- reconcile translates that into semantic `ui_patterns`
- implementation references remember which local components currently realize those patterns

This keeps imports portable across frameworks and supports the normal `propose -> review -> adopt` flow.

## Recommended file and artifact direction

If implemented, the likely first locations are:

- `engine/src/realization/ui/`
- `engine/src/generator/apps/web/`
- `examples/todo/implementation/web/`
- `examples/issues/implementation/web/`

Likely additions:

- a composition builder in UI realization
- an implementation-side pattern registry for web examples
- implementation-side pattern renderers
- thinner page renderers that assemble screens from semantic patterns instead of hand-building the whole page each time

## Phased rollout

### Phase 1: web-first proof

- keep the current DSL mostly intact
- derive a composition artifact from existing UI semantics
- add a web pattern registry for one example
- migrate a small number of screens first, such as `task_list` and `task_detail`

### Phase 2: recommendations and renderer simplification

- convert page renderers into thin assemblers of semantic patterns
- standardize slots and prop contracts across examples
- reduce handwritten, page-specific composition logic
- add recommendation metadata for common composition choices

### Phase 3: reuse and selective promotion

- use `ui_patterns` as part of Topogram package reuse/import
- evaluate whether the pattern vocabulary is stable enough for stronger canonical treatment
- promote a small semantic registry into long-lived Topogram surfaces only after implementation experience
- avoid first-class framework component declarations in `.tg` unless there is clear evidence they are the right abstraction

## Recommendation

Proceed with:

- `ui_patterns` first
- web first
- implementation-side pattern registries first
- canonical semantic pattern vocabulary later, but only in a limited, stable form

Do not start by making framework-level components first-class `.tg` concepts.

The near-term goal is not to model an entire design system. The goal is to give agents a better, narrower assembly target between screen semantics and generated UI code, while also creating a durable home for recommendations and reusable imported Topogram UI intent.
