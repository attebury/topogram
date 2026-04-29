# Topogram Engine

This folder contains the Topogram implementation: parser, validator, resolver, generators, runtime bundle emitters, and CLI.

The active product workflow is authoring-to-generated-app. Engine development should stay separate from user-facing demos.

## Package Shape

The engine is still private, but it exposes a local CLI binary:

```json
{
  "bin": {
    "topogram": "./src/cli.js"
  }
}
```

This lets demos consume the engine through a local file dependency and call:

```bash
topogram create ../my-app
topogram check
topogram build
```

No global install or published npm package is assumed yet. Create generated projects outside `engine/`; this directory is source and test code.

From the repo root, prefer:

```bash
npm run new -- ./my-topogram-app
```

## Layout

- `src/` - engine source
- `templates/` - starter Topogram workspaces for `topogram new`
- `tests/active/` - retained active engine tests
- `tests/fixtures/workspaces/` - engine-owned Topogram workspaces
- `tests/fixtures/expected/` - engine-owned golden outputs
- `tests/fixtures/invalid/` - invalid model cases

User-facing generated app demos live outside the engine under `../demos/generated/**`.

## Active Fixture

The current generated-app regression fixture is:

```text
tests/fixtures/workspaces/app-basic/
tests/fixtures/expected/app-basic/
```

It is a fixture, not a user example.

## Commands

Run the engine gate:

```bash
npm run check
```

Create a starter project from the current Foundation MVP template:

```bash
npm run new -- ../my-topogram-app
```

Do not create generated projects under `engine/`. The CLI refuses paths inside the engine directory.

Run the same gate directly:

```bash
npm test
```

Run only the active fixture validity check:

```bash
npm run fixture:status
```

Inspect the active fixture topology as JSON:

```bash
npm run fixture:inspect
```

Generate the active fixture app bundle:

```bash
npm run fixture:build
```

Run the app-generation workflow test:

```bash
node --test ./tests/active/generated-app-workflow.test.js
```

Validate or generate through the public CLI shape:

```bash
node ./src/cli.js check ./tests/fixtures/workspaces/app-basic
node ./src/cli.js build ./tests/fixtures/workspaces/app-basic --out /tmp/topogram-app
```
