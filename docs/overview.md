# Overview

Topogram's current goal is simple: author a Topogram and generate a runnable app from it.

## Current Scope

In scope:

- the engine under `engine/`
- the generated Todo demo under `examples/generated/todo/`
- validation, generation, compile, smoke, and runtime-check flows

Out of scope for now:

- brownfield import
- maintained-app workflows
- parity proof matrices
- launch and alpha planning

## First Run

Use Node 20+.

```bash
cd engine
npm test
```

Then compile the generated Todo demo:

```bash
cd ../examples/generated/todo/apps/local-stack
npm run compile
```

Use the repo-root smoke path when local services and database state are ready:

```bash
bash ./scripts/verify-generated-example.sh todo compile-smoke
```

Use `full` when you also need the slower runtime-check path:

```bash
bash ./scripts/verify-generated-example.sh todo full
```

## Where To Edit

Edit the Todo model here:

```text
examples/generated/todo/topogram/
```

Generated output is written under:

```text
examples/generated/todo/artifacts/
examples/generated/todo/apps/
```

Treat generated output as disposable. Change the Topogram, then regenerate.

## Engine Development

Engine fixtures should live under `engine/tests/fixtures/**`.

The Todo demo is a product workflow proof, not the only engine regression fixture. Keep reusable engine tests close to the engine, and keep demo-specific behavior in the demo.
