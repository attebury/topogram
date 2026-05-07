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
  "includesExecutableImplementation": true,
  "starterScripts": {
    "widget:behavior:query": "topogram query widget-behavior ./topogram --projection proj_web_surface --json"
  }
}
```

Set `includesExecutableImplementation` to `true` when the pack ships an
`implementation/` provider. `topogram new` copies that code but does not run it.
`topogram generate` may load it later through `topogram.project.json`, so
generated projects record local trust in `.topogram-template-trust.json`.

Use `starterScripts` only for template-specific root `package.json` commands.
The CLI keeps generic scripts such as `check`, `generate`, `query:list`,
`query:show`, and `template:status` standard across starters, while template
packs can add focused commands that are valid for their own topology.

## Package Files

For npm packages, keep the package payload narrow:

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

Do not include consumer workspace metadata in a template package. In particular,
`.topogram-template-files.json` and `.topogram-template-trust.json` are written
inside projects created from a template; they should not live in the template
source repo or package payload. Add them to the template repo `.gitignore` if
you work with local trust commands while authoring.

## Usage

Use the default catalog-backed neutral starter:

```bash
topogram template list
topogram new --list-templates
topogram new ./my-app
```

Catalog starter aliases:

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

Use `topogram new --list-templates --json` when an agent or setup script needs
the same list with structured `surfaces`, `generators`, `stack`,
`includesExecutableImplementation`, and `recommendedCommand` fields.

Use a local template:

```bash
topogram new ./my-app --template ../my-template
```

Use a packed tarball:

```bash
npm pack --pack-destination /tmp/template-pack
topogram new ./my-app --template /tmp/template-pack/scope-template-0.1.0.tgz
```

Use a package-backed template:

```bash
topogram new ./todo-demo --template @topogram/template-todo
```

Use a catalog alias:

```bash
topogram template list
topogram catalog show todo
topogram new ./todo-demo --template todo
```

Catalog aliases resolve to package specs such as
`@topogram/template-todo@0.1.6`. The catalog is only an index; the
template package remains the source of versioned starter content. See
[Catalog](./catalog.md).

## Widget Contracts

Templates may include reusable `widget` statements under `topogram/widgets/`.
These contracts are platform-neutral and can be generated independently:

```bash
topogram generate ./topogram --generate ui-widget-contract
topogram generate ./topogram --generate ui-widget-contract --widget widget_data_grid
```

See [Widgets](./widgets.md) for the full grammar and pack roadmap.

Templates compose Topogram source, topology, generator IDs, and optional trusted
implementation code. Reusable stack realization belongs in generator packs, not
inside starter templates. See [Generator Packs](./generator-packs.md) for the
manifest and adapter contract.

If a template binds topology runtimes to package-backed generators, list those
generator packages in the template package `dependencies` or `devDependencies`.
`topogram new` copies dependencies whose package names include
`topogram-generator` into the generated starter `devDependencies`, so
`npm install` in the starter installs the generator adapters before
`topogram check` or `topogram generate` runs.

Generated starters also include `topogram.generator-policy.json`. That policy
controls package-backed generator execution during `topogram check` and
`topogram generate`. The starter policy starts with the default rule:
`@topogram/*` generators are allowed and other package scopes are blocked. Use
`topogram generator policy status`, `check`, `explain`, and
`pin <package@version>` after reviewing third-party generator packages. `status`
shows visible dependency, lockfile, and installed npm package versions; policy
pins still record generator manifest versions and approve exact packages rather
than whole third-party scopes.

SvelteKit and React template implementations can render supported widget
usage with stable packaged helpers:

```js
import { renderSvelteKitWidgetRegion } from "@topogram/cli/template-helpers/sveltekit.js";
import { renderReactWidgetRegion } from "@topogram/cli/template-helpers/react.js";
```

Pass the screen contract, region, top-level widget contracts, and the data
expression for that screen. Set `useTypescript: true` when generating typed
Svelte or React pages so callback parameters are emitted with explicit types.
Every web generator should be contract-complete by default: the Topogram
contract defines the route surface, and template implementation code may replace
generated files but must not define which screens exist. The SvelteKit generator
emits generic pages for routed screens first, then lets your implementation
override specific route files. Generator-owned pages use `widget_bindings` regions
before falling back to generic sample list markup.
SvelteKit and React also write `src/lib/topogram/generation-coverage.json`,
which lists the screen routes and widget usages that were rendered by the
implementation or by generic generation.
Vanilla web templates should still treat `widget_bindings` as contract metadata
until a concrete helper exists.

Public `@topogram/*` packages install from npmjs without extra `.npmrc`
configuration. Private package consumers need registry-specific npm auth; for
example, a private npm org scope might use:

```text
@internal:registry=https://registry.npmjs.org
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

If `topogram new` cannot install a private template package, the CLI reports
whether npm saw an auth failure, access denial, missing package/version, or
integrity mismatch. For local runs and CI, configure the package host's normal
npm token or trusted-publishing setup before running `npm install`.

Consumer repos can update their Topogram CLI dependency with:

```bash
topogram package update-cli --latest
```

The command updates `@topogram/cli`, refreshes stale lockfile tarball
metadata for the CLI package when needed, then runs any available consumer
scripts named `cli:surface`, `doctor`, `catalog:show`,
`catalog:template-show`, `check`, `pack:check`, and `verify` when dependencies
were installed or already current.
Informational scripts run independently. Verification scripts are mutually
exclusive, with `verify` preferred over `pack:check`, and `pack:check`
preferred over `check`.
See [Consumer Script Contract](./consumer-scripts.md) for the script meanings.
If npm package inspection fails, the command stops before mutating consumer
files. Fix npm registry access and rerun it so the local verification scripts
run against the installed package.

Maintained apps can intentionally leave the template update workflow with
`topogram template detach`. Detach removes template provenance from
`topogram.project.json` and removes the template baseline file. It keeps
executable implementation trust when `implementation/` remains configured, so
generation safety is still enforced independently of template metadata. Use
`topogram template explain` to see whether a project is attached or detached,
what trust remains, and which command to run next. Use `--dry-run --json` for
review and `--remove-policy` when the project should also delete
`topogram.template-policy.json`.

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
`topogram trust template` is intended for generated consumer projects after
human review. When run directly in a template source repo, it refuses to write
consumer trust metadata unless `--force` is provided.

Template packs must not contain symlinks under `topogram/`,
`topogram.project.json`, or `implementation/`. Topogram records hashes for the
real files it copies; symlinks can point outside the reviewed template or
generated project and are rejected by `topogram new`, `topogram template check`,
`topogram trust status`, and `topogram check`. Replace symlinks with real files
before publishing or trusting a template.

For template-attached projects, `implementation.module` must stay under
`implementation/`. Moving executable implementation code elsewhere bypasses the
trusted root, so `topogram check` and `topogram generate` refuse it. Move the
module back under `implementation/`, then run `topogram trust status`,
`topogram trust diff`, and `topogram trust template` after review.

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
version, and the candidate package spec to compare. It does not support local
templates.

## Template Allow Policy

Projects may define `topogram.template-policy.json` to control which templates a
human or agent can use for checks and updates:

```json
{
  "version": "0.1",
  "allowedSources": ["local", "package"],
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
local and package templates. `allowedTemplateIds` keeps updates on the expected
template family. `allowedPackageScopes` limits package templates by the actual
package source spec recorded in `topogram.project.json`, not only by the
template id. `executableImplementation` may be `allow`, `warn`, or `deny`.
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
