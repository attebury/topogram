# Engine Development

Engine development is separate from user-facing demos.

## Boundaries

- `engine/src/**`: parser, resolver, validator, generators, CLI, and runtime bundle code
- `engine/tests/fixtures/workspaces/**`: engine-owned Topogram workspaces for regression tests
- `engine/tests/fixtures/expected/**`: engine-owned expected outputs
- `demos/generated/**`: user-facing generated app demos
- `examples/**`: legacy transition material retained while the active surface moves to `demos/**`

Fixtures are not examples. They exist to keep engine behavior stable.

## Commands

Run the fast engine test lane:

```bash
cd engine
npm test
```

Run the current app-generation workflow test directly:

```bash
cd engine
node --test ./tests/narrow/generated-app-workflow.test.js
```

## App Fixture

The current app-generation fixture lives at:

```text
engine/tests/fixtures/workspaces/app-basic/
engine/tests/fixtures/expected/app-basic/
```

It exercises the public CLI aliases:

```bash
topogram validate <workspace>
topogram generate app <workspace> --out <dir>
```

The Todo demo may still be used as a product workflow proof, but it is not the primary engine fixture.
