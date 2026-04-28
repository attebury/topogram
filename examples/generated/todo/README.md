# Todo Example

This is the current generated app demo.

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
- Keep the first-use path focused on validating, generating, compiling, and smoke-checking Todo.
