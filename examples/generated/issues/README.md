# Issues Example

This is a secondary generated-app fixture. It is not part of the first-use path while the repo is being slimmed around Todo.

## Layout

- [topogram](./topogram): the canonical Issues Topogram package
- [topogram/tests/fixtures](./topogram/tests/fixtures): regression fixtures for the Issues Topogram package
- [implementation](./implementation): issue-specific implementation data and renderers used by the generic engine
- [artifacts](./artifacts): generated contracts, docs, schemas, and runtime bundles for the Issues example
- [apps](./apps): runnable generated runtimes for the Issues example

## Runtimes

- [apps/backend](./apps/backend): generated backend runtime
- [apps/web](./apps/web): generated React web runtime
- [apps/web-sveltekit](./apps/web-sveltekit): generated SvelteKit web runtime
- [apps/local-stack](./apps/local-stack): generated full local runnable stack

## Working Agreement

- Edit the Issues source in `topogram/`.
- Keep regression expectations in `topogram/tests/fixtures/`.
- Keep this fixture available for engine development, but do not use it as first-use documentation.
