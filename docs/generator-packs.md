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
src/index.js
```

`topogram-generator.json` contains the manifest. The package export must provide
an adapter with a synchronous `generate(context)` function:

```js
export const manifest = { /* manifest */ };

export function generate({
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
}
```

The adapter receives normalized contracts and returns generated files relative
to that component output directory. The v1 package loader uses Node package
resolution from the project root and calls the installed package export directly;
publish a CommonJS-compatible entry point such as `index.cjs` or a compatible
package export. Templates may include implementation code to customize generated
files, but reusable stack behavior should live in generator packages.

## Templates

Templates compose Topogram source, topology, generator IDs, and optional trusted
implementation code. They should list used generator IDs in
`topogram-template.json` for catalog display and compatibility review, but they
should not be the long-term home for reusable React, SvelteKit, Hono, Express,
Postgres, SQLite, Prisma, or Drizzle generation behavior.
