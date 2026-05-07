# Testing Strategy

Keep the test surface small while Topogram is rebuilt around engine-owned fixtures and package-consumer demos.

## Engine

Run the engine test suite from `engine/`:

```bash
npm test
```

Engine regression fixtures belong under:

```text
engine/tests/fixtures/
```

Engine tests must not import or reference generated demo workspaces. Generated apps are consumer verification targets, not engine dependencies.
Engine fixtures should also avoid product-branded implementation names, package
metadata, env vars, and generated labels. A fixture can use a sample domain, but
its vocabulary should describe the fixture and the engine behavior under test.

Tests must prove consumer-facing behavior, not paper over gaps. A check that
only asserts a marker string, a file count, or a mocked happy path is not enough
when the user contract is validation, generation, import adoption, app compile,
or runtime behavior. If Topogram accepts intent, tests should either prove the
intent is realized through the next meaningful boundary or assert the exact
diagnostic that tells the user it is not supported.

Widget tests follow the same rule. If `widget_bindings` wiring is accepted,
tests must cover validation, normalized contracts, import/adoption drafts, or
generated markup/coverage as appropriate. Unsupported widget usage should
fail with a clear validation or conformance diagnostic, not disappear from a
contract or generated app.

Importer fixtures are intentionally narrow. The engine keeps only small,
actively tested importer smoke inputs under `engine/tests/fixtures/import/`.
Large brownfield source snapshots belong in `topogram-project` deferred code or
a dedicated corpus repo, not in the active engine fixture tree.

## CLI Package

Run the CLI package smoke test from the repo root:

```bash
npm run cli:check
```

This packs `@topogram/cli`, installs it into a disposable consumer project, creates a starter with the installed `topogram` binary, then checks and generates the starter.
It also packs and consumes a local template tarball so template-package behavior stays covered without depending on the Todo demo.

The root `npm run smoke:test-app` command is a local first-use smoke for the
source checkout. It must run the generated starter's `verify` script after
generation; generate-only is not verification.

## Generated Todo Demo Consumer

The generated Todo demo lives in the `topogram-demo-todo` repo. It consumes the public `@topogram/cli` npmjs package and owns the package-consumer workflow:

```bash
cd ../topogram-demo-todo
npm install
npm run check
npm run generate
npm run verify
```

Its normal GitHub Actions demo gate owns the generated Todo app compile and
runtime proof. Engine CI should keep validating engine fixtures and CLI package
behavior, not Todo-specific app semantics.

Run the smoke path when runtime services and local database state are available:

```bash
npm run bootstrap
npm run dev
```

Then, from another terminal while the app is still running:

```bash
npm run app:smoke
npm run app:runtime-check
```

Use the self-contained local runtime command when you want the generated stack
started and stopped for the probe:

```bash
npm run app:runtime
```
