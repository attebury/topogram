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
    "id": "@topogram/generator-react-web",
    "version": "1",
    "package": "@topogram/generator-react-web"
  },
  "api": "app_api",
  "port": 5173
}
```

Before a generator runs, Topogram resolves the component, validates generator
compatibility, and builds normalized contracts for that surface:

- web: `ui-web-contract`, including inherited shared screens, component
  placements, behavior realizations, semantic design tokens, and related API
  contracts;
- api: `server-contract` and API contracts;
- database: DB contract and lifecycle plan;
- native: routed UI contract with the same semantic UI sections and API
  contracts.

The generator owns framework files such as React routes, SvelteKit
`+page.svelte` files, Express or Hono handlers, Postgres SQL, SQLite lifecycle
scripts, Prisma schemas, or Drizzle schemas.

Topogram does not normalize framework component trees or raw styling.
Generator packs map semantic UI intent such as density, tone, color roles,
typography roles, action roles, radius scale, and accessibility hints into their
own CSS, classes, or framework modifiers.

## Manifest

Package-backed and bundled fallback generators use the same manifest shape:

```json
{
  "id": "@topogram/generator-react-web",
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
  "componentSupport": {
    "patterns": ["resource_table", "data_grid_view"],
    "behaviors": ["selection", "sorting", "filtering"],
    "unsupported": "warning"
  },
  "source": "package",
  "package": "@topogram/generator-react-web"
}
```

`source: "package"` means the generator lives in an already installed package.
Topogram does not dynamically install unknown generator packages; a project or
template must declare and install the package through normal package-manager
workflow before `topogram check` or `topogram generate` can use it.
`source: "bundled"` means the generator ships with `@topogram/cli` as a
compatibility fallback for engine fixtures and older topology bindings.

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
| `componentSupport` | optional | Declares supported component `patterns`, supported behavior kinds, and how unsupported component usage is handled: `error`, `warning`, or `contract-only`. |
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
    "id": "@topogram/generator-react-web",
    "version": "1",
    "package": "@topogram/generator-react-web"
  },
  "api": "app_api",
  "port": 5173
}
```

The project package must also declare the generator dependency so Node can
resolve it during `topogram check` and `topogram generate`:

```json
{
  "devDependencies": {
    "@topogram/cli": "^0.3.24",
    "@topogram/generator-react-web": "^0.1.0"
  }
}
```

The generator package must expose `topogram-generator.json`. The manifest `id`,
`version`, `source`, and `package` must match the topology binding.

Web generator adapters should consume the normalized UI contract instead of
inferring behavior from framework code. Component usages include
`behaviorRealizations`, which bridge component behavior declarations to concrete
projection data bindings, event bindings, navigation effects, and command
effects.

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

Generator adapters should prefer `contracts` over raw projection internals for
consumer-visible semantics. For example, API generators should render routes
from `contracts.server.routes` so capability ids, success statuses, request
contracts, and response contracts stay normalized across bundled and
package-backed generators. Raw projection fields are a compatibility fallback,
not the primary generation contract.

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
topogram generator show @topogram/generator-react-web
topogram generator show @scope/topogram-generator-example-web --json
```

`generator list` reports bundled generators plus installed generator packages
declared in the current `package.json` dependencies. `generator list` and
`generator show` read generator manifests only; they do not import adapter code
or execute generator packages. `generator show` accepts an already installed
package name or a bundled fallback generator id and prints the manifest, stack,
capabilities, and an example `topology.components[]` binding.

When `topogram check` sees a package-backed topology binding whose package is
not installed, it reports the component id, generator id/version, package name,
and the install command to run from the project root:

```bash
npm install -D @scope/topogram-generator-example-web
```

`topogram check` also enforces `topogram.generator-policy.json` for
package-backed generator packages. Bundled `topogram/*` generators are part of
the installed CLI package and are allowed. If no policy file exists, the default
project policy allows `@topogram/*` generator packages and blocks other package
scopes until they are reviewed.

Generator policy commands:

```bash
topogram generator policy init
topogram generator policy status
topogram generator policy status --json
topogram generator policy check
topogram generator policy check --json
topogram generator policy explain
topogram generator policy explain --json
topogram generator policy pin @scope/topogram-generator-example-web@1
```

The policy file shape is:

```json
{
  "version": "0.1",
  "allowedPackageScopes": ["@topogram"],
  "allowedPackages": [],
  "pinnedVersions": {
    "@topogram/generator-react-web": "1"
  }
}
```

Use `allowedPackageScopes` for reviewed package families and
`allowedPackages` for exact exceptions. `pinnedVersions` pins the generator
manifest version used in `topogram.project.json`, not necessarily the npm
package version. `topogram generator policy init` writes the default policy; it
does not approve third-party package bindings. `topogram generator policy pin`
adds the reviewed package as an exact `allowedPackages` entry and records its
current topology binding version. It does not broaden approval to the whole
third-party package scope.
`topogram generator policy status` shows each package-backed binding, whether it
is allowed, its manifest-version pin state, and any npm dependency, lockfile, or
installed package version visible from the project. npm `package-lock.json`
entries are inspected for package versions; pnpm, Yarn, and Bun lockfiles are
reported as present but their package versions are not parsed by this command.

Third-party generator adoption workflow:

```bash
npm install -D @scope/topogram-generator-example-web
topogram generator check @scope/topogram-generator-example-web
topogram generator show @scope/topogram-generator-example-web
topogram generator policy status
topogram generator policy explain
topogram generator policy pin @scope/topogram-generator-example-web@1
topogram check
topogram generate
```

Review the package source, manifest, npm package version, and lockfile change
before pinning. The generator policy pin records the manifest version; the
package manager lockfile is the control that pins the npm tarball/version.

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

Unlike `generator list` and `generator show`, `generator check` intentionally
loads the package adapter and executes a minimal smoke `generate(context)` call.
Only run it after installing and reviewing the package you intend to check.

Installed package-backed generators can also be checked from a consumer project:

```bash
topogram generator check @scope/topogram-generator-example-web
topogram generator check @scope/topogram-generator-example-web --json
```

Topogram does not install packages during `generator check`. For private
generator packages, run `npm install` first with the npm auth configuration
required by that registry.

The smoke context is intentionally small. It proves the adapter boundary and
manifest compatibility, not complete app behavior. Generator packages should add
their own focused tests for framework-specific output, route generation,
database lifecycle behavior, and compile/runtime checks.

## Trust And Execution

Generator packages are executable dependencies. Topogram never downloads or
executes arbitrary generator code by catalog lookup alone. A project or template
must declare generator package dependencies, install them through the package
manager, and bind them in `topogram.project.json`. `topogram check` validates the
installed manifest, compatibility, and `topogram.generator-policy.json` before
generated app writes. `topogram generate` enforces generator policy before
loading any package adapter, then executes `generate(context)` only for allowed
bindings.

Use normal package trust controls:

- review package source before adopting it;
- pin versions in templates or lockfiles where reproducibility matters;
- keep `topogram.generator-policy.json` narrow and review policy changes;
- keep package `files` allowlists narrow;
- avoid install lifecycle scripts unless they are truly needed;
- use the package host's access controls for private generators.

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
