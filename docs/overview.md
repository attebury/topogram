# Overview

Topogram's current goal is simple: author a Topogram and generate a runnable app from it.

## Current Scope

The active scope is the private CLI package under `engine/` and engine-owned fixtures under `engine/tests/fixtures/`. The generated Todo demo lives in the private `topogram-demo-todo` repo as the package-consumer test.
The private `attebury/topograms` repo owns the catalog index that maps stable
ids like `todo` to versioned template or topogram packages.

## First Run

Use Node 20+.

Run the disposable generated-app smoke test:

```bash
cd topogram
npm install
npm run smoke:test-app
npm run cli:check
```

This writes to `.tmp/smoke-test-app`.

```bash
cd topogram
npm install
```

Create a starter project outside `engine/`:

```bash
npm run new -- ./my-topogram-app
cd ./my-topogram-app
npm install
npm run explain
npm run check
npm run generate
npm run verify
```

Use the local runtime checks when local services are ready:

```bash
npm run bootstrap
npm run dev
```

Then, from another terminal while the app is still running:

```bash
npm run app:smoke
npm run app:runtime-check
```

## Where To Edit

Edit the Topogram model here:

```text
my-topogram-app/topogram/
```

Edit stack, topology, output ownership, ports, and generator bindings here:

```text
my-topogram-app/topogram.project.json
```

Generated output is written under:

```text
my-topogram-app/app/
```

Treat generated output as disposable. Change the Topogram, then regenerate.

## Engine Development

Engine fixtures should live under `engine/tests/fixtures/**`.

The Todo demo is a product workflow proof in the private `topogram-demo-todo` repo. Keep reusable engine tests close to the engine.
The catalog index is validated with `topogram catalog check`; package contents
remain owned by their template or topogram package repos.
