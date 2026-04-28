# Active Plan

This is the current operating plan for the Topogram reset.

## Objective

Make Topogram understandable and complete around one workflow:

- author a Topogram
- validate it
- generate a runnable app
- run and verify that generated app

The current active demo is:

- [demos/generated/todo-demo-app](../../../demos/generated/todo-demo-app)

## Canonical Story

Topogram turns authored product intent into generated application code and generated verification.

The active evaluator path is:

1. read [README.md](../../../README.md)
2. open [demos/generated/todo-demo-app](../../../demos/generated/todo-demo-app)
3. inspect or edit `topogram/`
4. run `npm run topogram:validate`
5. run `npm run topogram:generate`
6. run the generated app and checks

## Active Workstreams

### 1. Authoring-to-app workflow

- keep the Todo generated demo runnable
- make the CLI shape obvious: `topogram validate` and `topogram generate app`
- keep generated app output under `app/`

### 2. Engine/test separation

- use `engine/tests/fixtures/**` for engine regression confidence
- use `demos/generated/**` for user-facing product demos
- avoid using user demos as the only engine fixture

### 3. Docs and repo shape

- point README and docs first at the generated app workflow
- keep archived example material in `topogram-project/project/topogram/deferred-code/examples/`
- keep `topogram-demo` as deferred imported/brownfield proof history

## Deferred

These are not deleted, but they are not part of the active quickstart:

- import/adopt workflows
- maintained-app evolution proof
- brownfield proof operations
- agent planning surfaces
- global install and npm publishing
- `topogram-demo` as an active product dependency

## Done For This Reset

- the feature branch has `demos/generated/todo-demo-app`
- the engine has app-generation fixtures under `engine/tests/fixtures`
- the demo consumes the private local engine package
- the README and docs point first to authoring-to-app
- `npm test` from `engine` covers the new public app-generation CLI aliases
