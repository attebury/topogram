# Generator Packs

Topogram normalizes generation around contracts, generator manifests, and
topology components. The core engine owns parsing, validation, resolved graph
contracts, topology, output ownership, template/catalog lifecycle, and trust
policy. Stack-specific realization belongs behind generator manifests.

## Model

`topogram.project.json` binds each topology component to a generator:

```json
{
  "id": "app_web",
  "type": "web",
  "projection": "proj_ui_web",
  "generator": {
    "id": "topogram/react",
    "version": "1"
  },
  "api": "app_api",
  "port": 5173
}
```

Before a generator runs, Topogram resolves the component, validates generator
compatibility, and builds normalized contracts for that surface:

- web: `ui-web-contract` and related API contracts;
- api: `server-contract` and API contracts;
- database: DB contract and lifecycle plan;
- native: routed UI contract and API contracts.

The generator owns framework files such as React routes, SvelteKit
`+page.svelte` files, Express or Hono handlers, Postgres SQL, SQLite lifecycle
scripts, Prisma schemas, or Drizzle schemas.

## Manifest

Bundled and future package-backed generators use the same manifest shape:

```json
{
  "id": "topogram/react",
  "version": "1",
  "surface": "web",
  "projectionPlatforms": ["ui_web"],
  "inputs": ["ui-web-contract", "api-contracts"],
  "outputs": ["web-app", "generation-coverage"],
  "stack": {
    "runtime": "browser",
    "framework": "react",
    "language": "typescript"
  },
  "capabilities": {
    "routes": true,
    "components": true,
    "coverage": true
  },
  "source": "bundled"
}
```

`source: "bundled"` means the generator ships with `@attebury/topogram`.
`source: "package"` means the generator lives in an already installed package.
Topogram does not dynamically install unknown generator packages; a project or
template must declare and install the package through normal package-manager
workflow before `topogram check` or `topogram generate` can use it.

Manifest fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable generator id used by `topogram.project.json` topology bindings. Package-backed generators commonly use the package name. |
| `version` | yes | Generator interface version, not necessarily the npm package version. Topology bindings must match it. |
| `surface` | yes | One of `web`, `api`, `database`, or `native`; must match the topology component `type`. |
| `projectionPlatforms` | yes | Projection platform keys this generator can realize, such as `ui_web`, `api`, `db_postgres`, `db_sqlite`, or `ui_ios`. |
| `inputs` | yes | Normalized contract names the generator expects, such as `ui-web-contract`, `server-contract`, `api-contracts`, `db-contract`, or `db-lifecycle-plan`. |
| `outputs` | yes | Artifact families produced by the generator, such as `web-app`, `api-service`, `db-lifecycle-bundle`, or `generation-coverage`. |
| `stack` | yes | Human-readable stack metadata for docs, catalogs, and compatibility review. |
| `capabilities` | yes | Boolean feature flags such as `routes`, `components`, `coverage`, `http`, `persistence`, or `migrations`. |
| `source` | yes | `bundled` for CLI-owned adapters or `package` for external package-backed generators. |
| `package` | package-backed | Package name used for Node resolution. Required when `source` is `package`. |
| `export` | optional | Named export to load when the adapter is not the package default export. |

Package-backed topology bindings include the package name explicitly:

```json
{
  "id": "app_web",
  "type": "web",
  "projection": "proj_ui_web",
  "generator": {
    "id": "@attebury/topogram-generator-react",
    "version": "1",
    "package": "@attebury/topogram-generator-react"
  },
  "api": "app_api",
  "port": 5173
}
```

The package must expose `topogram-generator.json`. The manifest `id`,
`version`, `source`, and `package` must match the topology binding.

## Package Layout

A package-backed generator should use this layout:

```text
topogram-generator.json
package.json
README.md
index.cjs
scripts/verify.mjs
.github/workflows/generator-verification.yml
```

The package should publish only the generator runtime and docs:

```json
{
  "name": "@scope/topogram-generator-example-web",
  "version": "0.1.0",
  "type": "commonjs",
  "main": "index.cjs",
  "files": [
    "index.cjs",
    "topogram-generator.json",
    "README.md"
  ],
  "scripts": {
    "check": "topogram generator check ."
  }
}
```

`topogram-generator.json` contains the manifest. The package export must provide
an adapter object with a matching `manifest` and synchronous `generate(context)`
function:

```js
exports.manifest = require("./topogram-generator.json");

exports.generate = function generate({
  graph,
  projection,
  component,
  topology,
  contracts,
  implementation,
  options
}) {
  return {
    files: {},
    artifacts: {},
    diagnostics: []
  };
};
```

The adapter receives normalized contracts and returns generated files relative
to that component output directory. `files` must be an object whose keys are
relative paths and whose values are string file contents. `artifacts` and
`diagnostics` are optional.

The v1 package loader uses Node package resolution from the project root and
calls the installed package export directly; publish a CommonJS-compatible entry
point such as `index.cjs` or a compatible package export. Templates may include
implementation code to customize generated files, but reusable stack behavior
should live in generator packages.

## Discovery And Conformance

Consumers can inspect generator availability before editing topology bindings:

```bash
topogram generator list
topogram generator list --json
topogram generator show topogram/react
topogram generator show @scope/topogram-generator-example-web --json
```

`generator list` reports bundled generators plus installed generator packages
declared in the current `package.json` dependencies. `generator show` accepts a
bundled generator id or an already installed package name and prints the
manifest, stack, capabilities, and an example `topology.components[]` binding.

Generator authors should expose `npm run check` and back it with:

```bash
topogram generator check .
topogram generator check . --json
```

The command validates:

- `topogram-generator.json` exists and parses;
- manifest schema fields are present and valid;
- the adapter export can be loaded;
- the adapter exports a manifest matching `topogram-generator.json`;
- the adapter exports `generate(context)`;
- a minimal smoke `generate(context)` call returns a valid `{ files }` object.

Installed package-backed generators can also be checked from a consumer project:

```bash
topogram generator check @scope/topogram-generator-example-web
topogram generator check @scope/topogram-generator-example-web --json
```

Topogram does not install packages during `generator check`. For private GitHub
Packages, run `npm install` first with `NODE_AUTH_TOKEN` or an authenticated npm
configuration.

The smoke context is intentionally small. It proves the adapter boundary and
manifest compatibility, not complete app behavior. Generator packages should add
their own focused tests for framework-specific output, route generation,
database lifecycle behavior, and compile/runtime checks.

## Trust And Execution

Generator packages are executable dependencies. Topogram never downloads or
executes arbitrary generator code by catalog lookup alone. A project or template
must declare generator package dependencies, install them through the package
manager, and bind them in `topogram.project.json`. `topogram check` validates the
installed manifest and compatibility. `topogram generate` loads the installed
adapter and executes `generate(context)`.

Use normal package trust controls:

- review package source before adopting it;
- pin versions in templates or lockfiles where reproducibility matters;
- keep package `files` allowlists narrow;
- avoid install lifecycle scripts unless they are truly needed;
- use GitHub Packages access controls for private generators.

## Templates

Templates compose Topogram source, topology, generator IDs, and optional trusted
implementation code. They should list used generator IDs in
`topogram-template.json` for catalog display and compatibility review, but they
should not be the long-term home for reusable React, SvelteKit, Hono, Express,
Postgres, SQLite, Prisma, or Drizzle generation behavior.

Template package `devDependencies` should include the generator packages used by
topology bindings. A generated starter carries those dependencies into the
consumer project, so `topogram check` and `topogram generate` can resolve the
same package-backed generator manifests.

Example topology component in a template:

```json
{
  "id": "app_web",
  "type": "web",
  "projection": "proj_ui_web",
  "generator": {
    "id": "@scope/topogram-generator-example-web",
    "version": "1",
    "package": "@scope/topogram-generator-example-web"
  },
  "api": "app_api",
  "port": 5173
}
```

Example template package dependency:

```json
{
  "devDependencies": {
    "@scope/topogram-generator-example-web": "^0.1.0"
  }
}
```
