# Contributing

Topogram changes should start from the repo laws in [AGENTS.md](./AGENTS.md) and the product decisions in `topogram-project`.

## Before Changing Code

- Read the relevant public docs under [docs/](./docs/).
- Check `topogram-project/project/program/hardening-plan.md` for current execution order.
- Prefer focused fixes with focused tests over broad cleanup.
- Keep generated demo/product behavior out of engine tests and neutral fixtures.

## Review Checklist

- Does the change preserve the Topogram spec as the source of truth?
- Does it respect generated vs maintained ownership?
- Does it keep stack-specific realization inside generator adapters/packages?
- Does it avoid implicit trust in templates, package specs, local `.npmrc`, GitHub tokens, or generated HTML?
- Do docs and CLI help describe commands that are covered by tests?
- Does every new test prove behavior a consumer or agent relies on?

## Verification

Run a focused test for the area you changed, then run the engine gate:

```bash
node --test engine/tests/active/<focused-test>.test.js
bash ./scripts/verify-engine.sh
```

When package install, starter creation, generated app output, or CLI packaging changes, also run:

```bash
bash ./scripts/verify-cli-package.sh
```

When generator output changes, run the generated output's compile/check command. String checks and file-existence checks are not sufficient.

## Project Docs

Internal roadmap, operating laws, and product-management notes belong in `topogram-project`. This repository should contain engineering guidance, public docs, implementation, fixtures, and executable tests.
