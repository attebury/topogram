# Issues Example

This folder is a second example Topogram package used to validate that the engine is not secretly Todo-specific.

It is also the current first explicit multi-target proof for the same domain across two web realizations:

- React via `proj_ui_web`
- SvelteKit via `proj_ui_web_sveltekit`

That proof is documented in [docs/multi-target-proof-issues.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-issues.md).

It now also carries the first explicit multi-runtime proof for the same domain across two backend realizations:

- Hono via `hono-server`
- Express via `express-server`

That proof is documented in [docs/multi-runtime-proof-issues.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-issues.md).

## Layout

- [topogram](/Users/attebury/Documents/topogram/examples/issues/topogram): the canonical Issues Topogram package
- [implementation](/Users/attebury/Documents/topogram/examples/issues/implementation): issue-specific implementation data and renderers used by the generic engine
- [artifacts](/Users/attebury/Documents/topogram/examples/issues/artifacts): generated contracts, docs, schemas, and runtime bundles for the Issues example
- [apps](/Users/attebury/Documents/topogram/examples/issues/apps): runnable generated runtimes for the Issues example

## Working Agreement

- Edit the Issues source in `topogram/`.
- Use this example to test whether the engine handles a non-Todo domain cleanly.
- This example now has its own runnable backend, React web app, SvelteKit web app, local stack bundle, and runtime-check bundle generated from example-owned implementation modules.
- Treat the React and SvelteKit apps here as two realizations of one canonical `issues` model, not as two unrelated examples.
- Treat the Hono and Express backend bundles here as two backend realizations of the same canonical `issues` API semantics.
