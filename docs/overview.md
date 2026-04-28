# Overview

Topogram's current goal is simple: author a Topogram and generate a runnable app from it.

## Current Scope

The active scope is the engine under `engine/`, the generated Todo demo under `demos/generated/todo-demo-app/`, and the check, generation, compile, smoke, and runtime-check flows.

## First Run

Use Node 20+.

```bash
cd engine
npm test
```

Then run the generated Todo demo path:

```bash
cd ../demos/generated/todo-demo-app
npm install
npm run topogram:check
npm run topogram:generate
npm run app:compile
```

Use the local runtime checks when local services are ready:

```bash
npm run app:bootstrap
npm run app:dev
npm run app:smoke
npm run app:runtime-check
```

## Where To Edit

Edit the Todo model here:

```text
demos/generated/todo-demo-app/topogram/
```

Edit stack, topology, output ownership, ports, and generator bindings here:

```text
demos/generated/todo-demo-app/topogram.project.json
```

Generated output is written under:

```text
demos/generated/todo-demo-app/app/
```

Treat generated output as disposable. Change the Topogram, then regenerate.

## Engine Development

Engine fixtures should live under `engine/tests/fixtures/**`.

The Todo demo is a product workflow proof, not the only engine regression fixture. Keep reusable engine tests close to the engine, and keep demo-specific behavior in the demo.
