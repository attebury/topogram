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

Validate a local or remote catalog:

```bash
topogram catalog check topograms.catalog.json
topogram catalog check topograms.catalog.json --json
```

Create a starter from a catalog template alias:

```bash
topogram template list
topogram new ./todo-demo --template todo
```

Copy a pure topogram package for editing:

```bash
topogram catalog copy hello ./hello-topogram
topogram catalog copy hello ./hello-topogram --version 0.1.0
```

Use a local catalog while developing:

```bash
topogram template list --catalog ./topograms.catalog.json
topogram new ./app --template todo --catalog ./topograms.catalog.json
topogram catalog copy hello ./hello-topogram --catalog ./topograms.catalog.json
```

Set `TOPOGRAM_CATALOG_SOURCE=none` to list only built-in templates.

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
      "defaultVersion": "0.1.2",
      "description": "Todo app starter",
      "tags": ["todo", "sveltekit", "hono", "postgres"],
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

For GitHub Actions consumers that need private packages, grant package access
from the package page:

1. Open the package.
2. Go to Package settings.
3. Under Manage Actions access, add the consumer repository.
4. Grant Read access.

The private `attebury/topograms` repo owns the catalog index. Template and
topogram packages own versioned content. Demo repos consume the published CLI
and catalog entries.
