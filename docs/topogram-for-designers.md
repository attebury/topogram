# Topogram for designers and product

A 5-minute orientation for designers, PMs, and anyone evaluating Topogram from the product side rather than the engineering side.

## What Topogram is

Topogram is a way to write the *meaning* of a product as a small, machine-readable model, and have the working app, API, UI surfaces, and proofs generated from that model.

You write what the product is. The repo derives how it runs.

For a designer, the practical change is:

- The model is the spec, and the spec is checked. There is no separate Confluence page that drifts.
- A capability (e.g. "create issue") exists once. The API endpoint, the UI flow, the validation rules, and the docs all read from that single declaration.
- When a rule changes — "an issue must have an assignee before it goes in_progress" — it changes in one place and the generated artifacts update with it.

## What the model looks like

Topogram models are written in a small DSL with the `.tg` extension. They are readable without learning the engine.

A real entity from the issues example, [`entity-issue.tg`](../examples/generated/issues/topogram/entities/entity-issue.tg):

```
entity entity_issue {
  name "Issue"
  description "A tracked work item in the issue tracker domain"

  fields {
    id uuid required
    title string required
    status issue_status required default open
    assignee_id uuid optional
    ...
  }

  invariants {
    closed_at requires status == closed
    status == in_progress implies assignee_id is required
    status == open implies closed_at is null
    title length <= 200
  }
}
```

A capability declaration sits alongside it, e.g. `cap-create-issue.tg`. Capabilities are the verbs a user can perform; entities are the nouns they act on. Together they define the product's surface area.

## See it end to end

Pick one of the three example domains and walk it from model to running app:

- **Issues** — issue tracker. Model in [`examples/generated/issues/topogram/`](../examples/generated/issues/topogram/), generated app in [`examples/generated/issues/apps/`](../examples/generated/issues/apps/).
- **Content approval** — editorial workflow with reviewer ownership. Model in [`examples/generated/content-approval/topogram/`](../examples/generated/content-approval/topogram/), generated app in [`examples/generated/content-approval/apps/`](../examples/generated/content-approval/apps/).
- **Todo** — minimal canary. Model in [`examples/generated/todo/topogram/`](../examples/generated/todo/topogram/), generated app in [`examples/generated/todo/apps/`](../examples/generated/todo/apps/).

For each example, the model directory has `entities/`, `capabilities/`, `projections/`, and `rules/`. The generated app directory has the actual server, web, and database code that comes out the other end.

## What is real today

- Three full domains generate working backends (Hono and Express), web UIs (React and SvelteKit), databases (Prisma + SQLite), and seed data.
- Authorization is modeled in `.tg` and enforced in the generated server. Two profiles ship: `bearer_demo` and `bearer_jwt_hs256`. See [auth-evaluator-path.md](./auth-evaluator-path.md).
- Brownfield import can read an existing app and propose an adoption plan. See [brownfield-import-roadmap.md](./brownfield-import-roadmap.md).
- The same model produces generated documentation, OpenAPI, and parity proofs that pin behavior across realizations. See [parity-evaluator-path.md](./parity-evaluator-path.md).

## What is not real yet

- There is no visual model editor. You read and edit `.tg` files in your editor.
- The DSL grammar is not yet written up for non-engineers in one place. The fastest route is to read the example `.tg` files; they are intentionally small.
- Generated UIs are functional, not designed. They prove the surface exists; they do not prove the surface is good.
- Topogram does not yet generate or consume design tokens, component libraries, or visual design specs.

## Where to go next

If you are deciding whether Topogram is worth more time:

- [Skeptical Evaluator Guide](./skeptical-evaluator.md) — direct answers to fair objections
- [Proof Points And Limits](./proof-points-and-limits.md) — exactly what is claimed and what is not
- [Topogram Workspace Layout](./topogram-workspace-layout.md) — how canonical, candidate, generated, and maintained surfaces relate
- [Topogram Product Glossary](./topogram-product-glossary.md) — the durable vocabulary
- [Maintained-App Boundary Mechanics](./maintained-app-boundary-mechanics.md) — how Topogram describes change in human-owned code
