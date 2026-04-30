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

Use the default built-in neutral starter:

```bash
topogram template list
topogram template show hello-web
topogram new ./my-app
TOPOGRAM_CATALOG_SOURCE=none topogram template list
```

Built-in starters:

```bash
topogram new ./hello-web
topogram new ./hello-api --template hello-api
topogram new ./hello-db --template hello-db
topogram new ./web-api --template web-api
topogram new ./web-api-db --template web-api-db
```

| Template | Surfaces | Stack | Notes |
| --- | --- | --- | --- |
| `hello-web` | web | Vanilla HTML/CSS/JS | Default starter, two pages, one workflow doc. |
| `hello-api` | api | Hono | API-only topology. |
| `hello-db` | database | SQLite | Database lifecycle output only. |
| `web-api` | web, api | React + Express | Executable implementation starter without a database. |
| `web-api-db` | web, api, database | SvelteKit + Hono + Postgres | Heavier full-stack executable implementation starter. |

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

Use a private catalog alias:

```bash
topogram template list
topogram template show todo
topogram new ./todo-demo --template todo
```

Catalog aliases resolve to package specs such as
`@attebury/topogram-template-todo@0.1.6`. The catalog is only an index; the
template package remains the source of versioned starter content. See
[Catalog](./catalog.md).

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

If `topogram new` cannot install a private template package, the CLI reports
whether npm saw an auth failure, access denial, missing package/version, or
integrity mismatch. For local runs, set `NODE_AUTH_TOKEN` to a token that can
read GitHub Packages. For CI, confirm both the `.npmrc` token wiring and the
package's Manage Actions access settings.

Consumer repos can update their Topogram CLI dependency with:

```bash
NODE_AUTH_TOKEN=<github-token-with-package-read> topogram package update-cli 0.2.40
```

The command updates `@attebury/topogram`, then runs any available consumer
scripts named `cli:surface`, `catalog:template-show`, and `check`.

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
topogram template status --latest
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

`topogram template status --latest` is the opt-in registry check for
package-backed templates. It reports the recorded version, latest package
version, and the candidate package spec to compare. It does not support local or
built-in templates.

## Template Allow Policy

Projects may define `topogram.template-policy.json` to control which templates a
human or agent can use for checks and updates:

```json
{
  "version": "0.1",
  "allowedSources": ["builtin", "local", "package"],
  "allowedTemplateIds": ["@scope/topogram-template-name"],
  "allowedPackageScopes": ["@scope"],
  "executableImplementation": "allow",
  "pinnedVersions": {
    "@scope/topogram-template-name": "0.1.0"
  }
}
```

New starters create a permissive policy for the template that created the
project. Existing projects can create or refresh one from their current
`topogram.project.json`:

```bash
topogram template policy init
topogram template policy check
topogram template policy check --json
topogram template policy explain
topogram template policy explain --json
topogram template policy pin @scope/topogram-template-name@0.1.0
```

Policy check succeeds with a warning when the file is missing so older projects
can adopt it incrementally. When the file exists, template update/status/check
commands enforce it before comparing candidate files. `allowedSources` controls
`builtin`, `local`, and package templates. `allowedTemplateIds` keeps updates on
the expected template family. `allowedPackageScopes` limits package templates by
the actual package source spec recorded in `topogram.project.json`, not only by
the template id. `executableImplementation` may be `allow`, `warn`, or `deny`.
`pinnedVersions` can force a reviewed exact template version until a human
updates the pin.

Use `topogram template policy explain` when a human or agent needs a readable
rule-by-rule answer to why the current template is allowed or denied. It reports
source, template id, package scope, executable implementation, pinned version,
and catalog provenance when the project came from a catalog alias.

Use `topogram template policy pin <template-id@version>` after reviewing a
candidate template. The command updates `pinnedVersions`, ensures the template id
is allowed, and records the package scope for scoped package templates.

This policy does not sign templates yet. Treat it as the v1 guardrail that makes
template intent explicit, checks package-backed source scope, and gives agents a
single file to inspect before changing template-owned project files.

## Template Updates

Review template changes first:

```bash
topogram template update --status
topogram template update --recommend
topogram template update --recommend --latest
topogram template update --plan
topogram template update --check
topogram template update --plan --template ./local-template
topogram template update --plan --template @scope/topogram-template-name@0.2.0
topogram template update --plan --json
topogram template update --status --out .topogram/template-update-report.json
topogram template update --apply
topogram template update --accept-current topogram/entities/entity-greeting.tg
topogram template update --accept-candidate topogram/entities/entity-greeting.tg --template ./local-template
topogram template update --delete-current topogram/entities/old-resource.tg --template ./local-template
```

Without `--template`, the command uses the recorded `sourceSpec` or `requested`
template metadata from `topogram.project.json`. To compare against a newer
package version, pass that version explicitly with `--template`.

The plan compares template-owned project files (`topogram/`,
`topogram.project.json`, and `implementation/` when present) with the candidate
template. It reports added, changed, and current-only files with hashes and text
diffs where practical. Plan mode never writes files and never executes template
implementation code.

Status mode uses the same comparison as plan mode and adds apply-readiness
analysis: missing baselines, local conflicts, and current-only files that need
manual delete review. It is intended for humans or agents deciding what to do
next before applying a template update.

Recommend mode is the concise next-action view. It reports current and candidate
versions, summarizes added/changed/current-only files, calls out conflicts, and
prints the next command to run: apply the candidate, accept current for a
conflict, delete a reviewed current-only file, or pin the reviewed version.
For package-backed projects, add `--latest` to use the latest registry version
as the candidate. This is explicit so CI and normal status checks do not make
surprise network calls.

Check mode is the no-write guard for CI and consumer repos. It exits zero when
the current project is aligned with the recorded or supplied template, and exits
nonzero when a template update is available or the candidate is invalid. Use it
when a workflow should fail until a human reviews and applies the update.

Any update mode can write a review artifact with `--out <path>`. The file uses
the same JSON shape as `--json`: current and candidate template metadata,
summary counts, file hashes and diffs, conflicts, skipped files, and structured
diagnostics. This is the preferred handoff packet for agents reviewing template
drift.

Apply mode writes only reviewed added/changed template-owned files. It records a
fresh `.topogram-template-files.json` baseline after a successful apply, skips
current-only deletes in this milestone, and refuses to overwrite a file that no
longer matches the last trusted template-owned baseline. Executable
implementation trust is refreshed after a successful apply.

Single-file adoption actions cover the common manual decisions from a status
report. Use `--accept-current <file>` when the local edit is intentional and
should become the new trusted baseline. Use `--accept-candidate <file>` when one
candidate file should replace the current file after baseline checks pass. Use
`--delete-current <file>` when the candidate template removed a file and the
current file still matches the trusted baseline. These actions mutate only the
named file or its baseline record.

Human output prints a compact summary before file diffs, including `No changes
to apply.`, `Applied N file(s).`, `Skipped N current-only file(s).`, and
`Refused due to N conflict(s).` JSON output includes `diagnostics[]` with
`code`, `severity`, `message`, `path`, `suggestedFix`, and `step` for
incompatible template IDs, missing baselines, local conflicts, skipped
current-only deletes, and template resolution failures.

For projects created before `.topogram-template-files.json` existed, review the
current template-owned files and run `topogram trust template` once to record the
baseline before using apply mode.

## Template Conformance

Template authors can run a reusable conformance check:

```bash
topogram template check ./my-template
topogram template check ./my-template --json
topogram template check @scope/topogram-template-name@0.2.0
```

The command validates the manifest and required layout, creates a temporary
starter, runs the same parse/project/trust checks as `topogram check`, verifies
executable-template trust metadata, and verifies that the starter can produce a
no-write template update plan. It does not compile generated apps and does not
execute template implementation code.

Human output keeps the temporary starter path visible, prints step details, and
groups diagnostics under failed steps. JSON output includes `diagnostics[]` with
`code`, `severity`, `message`, `path`, `suggestedFix`, and `step`.

After reviewing intentional edits in `implementation/`, refresh the trust record:

```bash
topogram trust template
```

Use templates from sources you trust, review implementation code before
generating, and keep product-specific implementation providers in external
template repositories rather than the engine package.
