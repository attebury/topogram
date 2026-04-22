# Content Approval Example

This folder is a second example Topogram package used to validate that the engine is not secretly Todo-specific.

It is also the second explicit multi-target proof for the same domain across two web realizations:

- React via `proj_ui_web`
- SvelteKit via `proj_ui_web_sveltekit`

That proof is documented in [docs/multi-target-proof-content-approval.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-content-approval.md).

It now also carries the second explicit multi-runtime proof for the same domain across two backend realizations:

- Hono via `hono-server`
- Express via `express-server`

That proof is documented in [docs/multi-runtime-proof-content-approval.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-content-approval.md).

## Layout

- [topogram](/Users/attebury/Documents/topogram/examples/content-approval/topogram): the canonical Content Approval Topogram package
- [topogram/tests/fixtures](/Users/attebury/Documents/topogram/examples/content-approval/topogram/tests/fixtures): regression fixtures for the Content Approval Topogram package
- [implementation](/Users/attebury/Documents/topogram/examples/content-approval/implementation): article-specific implementation data and renderers used by the generic engine
- [artifacts](/Users/attebury/Documents/topogram/examples/content-approval/artifacts): generated contracts, docs, schemas, and runtime bundles for the Content Approval example
- [apps](/Users/attebury/Documents/topogram/examples/content-approval/apps): runnable generated runtimes for the Content Approval example

## Runtimes

- [apps/backend](/Users/attebury/Documents/topogram/examples/content-approval/apps/backend): generated backend runtime
- [apps/web](/Users/attebury/Documents/topogram/examples/content-approval/apps/web): generated web runtime
- [apps/local-stack](/Users/attebury/Documents/topogram/examples/content-approval/apps/local-stack): generated full local runnable stack

## Working Agreement

- Edit the Content Approval source in `topogram/`.
- Keep regression expectations in `topogram/tests/fixtures/`.
- Use this example to test whether the engine handles a non-Todo domain cleanly.
- This example now has its own runnable backend, React web app, SvelteKit web app, local stack bundle, and runtime-check bundle generated from example-owned implementation modules.
- Treat the React and SvelteKit apps here as two realizations of one canonical `content-approval` model, not as two unrelated examples.
- Treat the Hono and Express backend bundles here as two backend realizations of the same canonical `content-approval` API semantics.
