# User Quickstart

Topogram's current happy path is authoring-to-generated-app.

Use the Todo demo:

```bash
cd demos/generated/todo-demo-app
npm install
```

Validate the authored Topogram:

```bash
npm run topogram:validate
```

Generate the app bundle:

```bash
npm run topogram:generate
```

Bootstrap and run the generated app:

```bash
npm run app:bootstrap
npm run app:dev
```

Run generated verification:

```bash
npm run app:compile
npm run app:smoke
npm run app:runtime-check
```

## Iteration Loop

1. Edit files under `topogram/`.
2. Validate with `npm run topogram:validate`.
3. Regenerate with `npm run topogram:generate`.
4. Run the generated app checks that match the change.

## Install Model

The demo consumes the private local engine package through:

```json
{
  "devDependencies": {
    "topogram": "file:../../../engine"
  }
}
```

That simulates the eventual project-local install path without requiring a global install or a published npm package.
