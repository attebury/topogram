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
topogram validate ./topogram
topogram generate app ./topogram --out ./app
```

No global install or published npm package is assumed yet.

## Layout

- `src/` - engine source
- `tests/narrow/` - focused engine tests
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

Run the engine test lane:

```bash
npm test
```

Run the app-generation workflow test:

```bash
node --test ./tests/narrow/generated-app-workflow.test.js
```

Validate or generate through the public CLI shape:

```bash
node ./src/cli.js validate ./tests/fixtures/workspaces/app-basic
node ./src/cli.js generate app ./tests/fixtures/workspaces/app-basic --out /tmp/topogram-app
```
