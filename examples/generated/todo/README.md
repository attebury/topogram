# Todo Example

This folder is the reference Todo example used to exercise the Topogram engine.

It is also the third explicit multi-target proof for the same domain across two web realizations at the emitted UI-contract seam:

- React via `proj_ui_web_react`
- SvelteKit via `proj_ui_web`

That proof is documented in [docs/multi-target-proof-todo.md](../../../docs/multi-target-proof-todo.md).

It is also now the third explicit multi-runtime proof for the same domain across two backend realizations at the emitted server-contract seam:

- Hono via `hono-server`
- Express via `express-server`

That proof is documented in [docs/multi-runtime-proof-todo.md](../../../docs/multi-runtime-proof-todo.md).

## Layout

- [topogram](./topogram): the canonical Todo Topogram package
- [topogram/tests/fixtures](./topogram/tests/fixtures): regression fixtures for the Todo Topogram package
- [implementation](./implementation): Todo-specific implementation details that should stay out of the generic engine
- [artifacts](./artifacts): generated contracts, docs, schemas, and runtime bundles
- [apps](./apps): runnable generated runtimes for the Todo example

## Runtimes

- [apps/backend](./apps/backend): generated backend runtime
- [apps/web](./apps/web): generated web runtime
- [apps/local-stack](./apps/local-stack): generated full local runnable stack

## Working Agreement

- Edit the Todo source in `topogram/`.
- Keep regression expectations in `topogram/tests/fixtures/`.
- Regenerate derived outputs into `artifacts/` and `apps/`.
- Treat the React and SvelteKit Todo web targets here as two realizations of one canonical `todo` model at the UI-contract seam, even though the committed runnable app surface remains SvelteKit-first today.
- Treat the Hono and Express Todo backend targets here as two realizations of one canonical `todo` model at the server-contract seam.
