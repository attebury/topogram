# Evaluator Path

This is the current evaluator flow for the generated-app reset.

## Short Version

1. Read [README.md](../README.md).
2. Open [demos/generated/todo-demo-app](../demos/generated/todo-demo-app).
3. Inspect `topogram/`.
4. Run:

```bash
cd demos/generated/todo-demo-app
npm install
npm run topogram:validate
npm run topogram:generate
npm run app:compile
```

5. Run `npm run app:bootstrap` and `npm run app:dev` to exercise the generated local stack.
6. Run `npm run app:smoke` and `npm run app:runtime-check` when local services are available.

## What This Proves

- a Topogram workspace can be validated through a user-facing CLI shape
- the engine can generate a runnable app bundle
- the generated bundle carries its own compile, smoke, and runtime-check entrypoints
- the demo consumes the engine like a local project dependency rather than requiring a repo-internal command

## Deferred Proof Material

Maintained-app, import/adopt, brownfield, planning, and `topogram-demo` materials are deferred during this reset. They remain useful reference material, but they are not the current evaluator path.
