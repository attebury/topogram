# Template Authoring

Topogram template packs are starter workspaces for `topogram new`.

## Required Layout

```text
topogram-template.json
topogram/
topogram.project.json
implementation/        # optional
package.json           # required for npm packages
```

`topogram-template.json` must include:

```json
{
  "id": "@scope/topogram-template-name",
  "version": "0.1.0",
  "kind": "starter",
  "topogramVersion": "0.1",
  "includesExecutableImplementation": true
}
```

Set `includesExecutableImplementation` to `true` when the pack ships an
`implementation/` provider. `topogram new` copies that code but does not run it.
`topogram generate` may load it later through `topogram.project.json`, so
generated projects record local trust in `.topogram-template-trust.json`.

## Package Files

For npm or GitHub Packages, keep the package payload narrow:

```json
{
  "files": [
    "topogram-template.json",
    "topogram",
    "topogram.project.json",
    "implementation"
  ]
}
```

## Usage

Use the built-in neutral starter:

```bash
topogram new ./my-app
```

Use a local template:

```bash
topogram new ./my-app --template ../my-template
```

Use a packed tarball:

```bash
npm pack --pack-destination /tmp/template-pack
topogram new ./my-app --template /tmp/template-pack/scope-template-0.1.0.tgz
```

Use a private GitHub Packages template:

```bash
topogram new ./todo-demo --template @attebury/topogram-template-todo
```

Private package consumers need registry auth in `.npmrc`:

```text
@attebury:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

For GitHub Actions consumers, grant the consuming repository access from the
package page:

1. Open the package.
2. Go to Package settings.
3. Under Manage Actions access, add the consumer repository.
4. Grant Read access.

## Trust Policy

Template packs are copied into the target project. Package install uses
`npm install --ignore-scripts`, so package lifecycle scripts do not run during
`topogram new`.

Implementation providers are different: if a template includes `implementation/`
and declares `includesExecutableImplementation: true`, the generated project may
load that code during `topogram generate`. `topogram new` writes
`.topogram-template-trust.json` with the template id, template version, source,
requested package or path, local source root where available, implementation
module, and SHA-256 hashes for the copied `implementation/` files.

If the trust file is missing or no longer matches `topogram.project.json`,
or if `implementation/` changed since it was trusted, `topogram check` and
`topogram generate` refuse to import `./implementation/index.js`. Inspect drift:

```bash
topogram template status
topogram template status --json
topogram trust status
topogram trust status --json
topogram trust diff
topogram trust diff --json
```

`topogram template status` is the user-facing lifecycle summary. It reports the
template provenance recorded in `topogram.project.json`, whether executable
implementation code is trusted, whether local files drifted, and that registry
latest-version checks are not performed by default.

## Template Update Plans

Template updates are plan-only in this milestone:

```bash
topogram template update --plan
topogram template update --plan --template ./local-template
topogram template update --plan --template @scope/topogram-template-name@0.2.0
topogram template update --plan --json
```

Without `--template`, the command uses the recorded `sourceSpec` or `requested`
template metadata from `topogram.project.json`. To compare against a newer
package version, pass that version explicitly with `--template`.

The plan compares template-owned project files (`topogram/`,
`topogram.project.json`, and `implementation/` when present) with the candidate
template. It reports added, changed, and current-only files with hashes and text
diffs where practical. It never writes files and never executes template
implementation code.

After reviewing intentional edits in `implementation/`, refresh the trust record:

```bash
topogram trust template
```

Use templates from sources you trust, review implementation code before
generating, and keep product-specific implementation providers in external
template repositories rather than the engine package.
