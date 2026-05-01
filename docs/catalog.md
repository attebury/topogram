# Catalog

The Topogram catalog is a private index of reusable template and topogram
packages. The default v1 source is:

```text
github:attebury/topograms/topograms.catalog.json
```

The catalog is not executable template storage. It only maps stable ids to
versioned packages.

## Commands

List catalog entries:

```bash
topogram catalog list
topogram catalog list --json
```

Inspect one catalog entry and its recommended command:

```bash
topogram catalog show todo
topogram catalog show hello
topogram catalog show hello --json
```

Template entries recommend `topogram new`. Pure topogram entries recommend
`topogram catalog copy` plus `topogram source status`.

Check private catalog and package access:

```bash
topogram catalog doctor
topogram catalog doctor --json
topogram catalog doctor --catalog ./topograms.catalog.json
```

`catalog doctor` loads and validates the catalog, reports GitHub token or
`gh auth` readiness for private GitHub catalog sources, and checks each entry's
package/version with npm. It is read-only and does not install packages.

For a complete new-user setup check, prefer the top-level doctor:

```bash
topogram doctor
topogram doctor --json
topogram doctor --catalog ./topograms.catalog.json
```

`topogram doctor` also checks Node.js, npm, GitHub Packages registry
configuration, `NODE_AUTH_TOKEN`, and access to the installed CLI package.

Validate a local or remote catalog:

```bash
topogram catalog check topograms.catalog.json
topogram catalog check topograms.catalog.json --json
```

Create a starter from a catalog template alias:

```bash
topogram template list
topogram catalog show hello-web
topogram new ./hello-web --template hello-web
topogram catalog show todo
topogram new ./todo-demo --template todo
```

Projects created from a catalog alias still use package-backed template
metadata. `topogram.project.json` records:

```json
{
  "template": {
    "source": "package",
    "requested": "todo",
    "sourceSpec": "@attebury/topogram-template-todo@0.1.6",
    "catalog": {
      "id": "todo",
      "source": "github:attebury/topograms/topograms.catalog.json",
      "package": "@attebury/topogram-template-todo",
      "version": "0.1.6",
      "packageSpec": "@attebury/topogram-template-todo@0.1.6"
    }
  }
}
```

`sourceSpec` remains the package spec used by template update, latest-version
checks, and trust policy. `requested` and `catalog` preserve the human-facing
alias and catalog source for auditability.

Package-backed catalog starters install `@attebury/topogram` from GitHub
Packages in the generated project. The generated `.npmrc` reads
`${NODE_AUTH_TOKEN}`, so run `npm install` with a token that can read the package:

```bash
cd ./hello-web
NODE_AUTH_TOKEN=<github-token-with-package-read> npm install
npm run check
npm run generate
```

Copy a pure topogram package for editing:

```bash
topogram catalog show hello
topogram catalog copy hello ./hello-topogram
topogram catalog copy hello ./hello-topogram --version 0.1.0
cd ./hello-topogram
topogram source status --local
topogram check
topogram generate
```

To inspect provenance from outside the copied project:

```bash
topogram source status ./hello-topogram --local
topogram source status ./hello-topogram --remote --json
```

`catalog copy` writes `.topogram-source.json` in the target workspace. That
file records the catalog id/source, package spec/version, copy time,
non-executable trust metadata, and SHA-256 hashes for imported `topogram/`,
`topogram.project.json`, and `README.md` files. `topogram source status --local` compares
the current files with that import baseline and reports changed, added, and
removed paths.

The source file is provenance only. Users and agents may edit copied topogram
files after import; this status command reports drift but does not block checks,
generation, or local maintenance. Template-created projects also report a
template baseline. If that baseline is `diverged`, the project owns those local
changes; it is update-review context, not a validity failure.

Use `--local` for day-to-day checks. Use `--remote` when package registry status
is intentionally part of the check; remote mode may require network and npm auth.

Human `source status` output always includes this distinction and suggested next
steps. Clean copied source can move directly to `topogram check` or
`topogram generate`. Changed source should be reviewed first, then checked and
generated when ready. Missing provenance means the workspace was not created by
`topogram catalog copy`, or the provenance file was removed.

Use a local catalog while developing:

```bash
topogram template list --catalog ./topograms.catalog.json
topogram catalog show todo --catalog ./topograms.catalog.json
topogram new ./app --template todo --catalog ./topograms.catalog.json
topogram catalog copy hello ./hello-topogram --catalog ./topograms.catalog.json
```

Set `TOPOGRAM_CATALOG_SOURCE=none` only when you intentionally want to skip
catalog discovery; `topogram template list` will then show no shared starters.

## Schema

`topograms.catalog.json`:

```json
{
  "version": "0.1",
  "entries": [
    {
      "id": "todo",
      "kind": "template",
      "package": "@attebury/topogram-template-todo",
      "defaultVersion": "0.1.6",
      "description": "Todo app starter",
      "tags": ["todo", "sveltekit", "hono", "postgres"],
      "surfaces": ["web", "api", "database"],
      "generators": ["topogram/sveltekit", "topogram/hono", "topogram/postgres"],
      "stack": "SvelteKit + Hono + Postgres",
      "trust": {
        "scope": "@attebury",
        "includesExecutableImplementation": true,
        "notes": "Copies template implementation into the generated project."
      }
    }
  ]
}
```

Required entry fields:

- `id` is the stable catalog alias.
- `kind` is `template` or `topogram`.
- `package` is an npm package name without a version.
- `defaultVersion` is the exact version or dist-tag used by default.
- `description` is human-facing catalog text.
- `tags` is an array of search/filter labels.
- `surfaces` is an optional array used by `topogram template list/show` to
  describe what the template creates without installing the package.
- `generators` is an optional array of generator ids used by the template.
- `stack` is an optional short human-facing stack label.
- `trust.scope` names the package scope or trust boundary.
- `trust.includesExecutableImplementation` is the visible v1 trust signal.

`topogram catalog check` validates the schema, duplicate ids, supported kinds,
package names, required version metadata, and trust metadata.

## Entry Kinds

Template entries feed `topogram new`. They may include executable
`implementation/` code when the package manifest and catalog trust metadata say
so. `topogram new` copies that implementation code but does not execute it.
`topogram check` and `topogram generate` enforce the project
`topogram.template-policy.json` and `.topogram-template-trust.json` before
loading copied implementation code.

Topogram entries feed `topogram catalog copy`. A pure topogram package may
contain:

```text
topogram/
topogram.project.json  # optional
README.md              # optional
```

Topogram entries must not contain `implementation/` in v1. Executable content
belongs in template packages, where template trust and project policy already
apply.

## Private Access

For `github:attebury/topograms/topograms.catalog.json`, the CLI uses `gh api`.
Set `GITHUB_TOKEN` or `GH_TOKEN`, or authenticate locally with:

```bash
gh auth login
```

Catalog auth failures are reported separately from missing catalog paths. A
401/403 means the token or local `gh` session cannot read the private catalog
repo. A 404 means the `github:owner/repo/path` source is wrong, or the current
token cannot see that repo.

`topogram new --template <catalog-id>` treats simple names such as `todo` as
catalog aliases. If the alias cannot be resolved, Topogram stops with catalog
guidance instead of falling through to an unrelated npm package install. Use a
local path or full package spec when you do not want catalog resolution.

For GitHub Actions consumers that need private packages, grant package access
from the package page:

1. Open the package.
2. Go to Package settings.
3. Under Manage Actions access, add the consumer repository.
4. Grant Read access.

The private `attebury/topograms` repo owns the catalog index. Template and
topogram packages own versioned content. Demo repos consume the published CLI
and catalog entries.
