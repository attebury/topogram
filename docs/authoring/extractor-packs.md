# Extractor Packs

Extractor packs are package-backed brownfield discovery extensions. They are
the extraction counterpart to generator packs, but their contract is narrower:
they read source evidence and emit review-only findings, candidates,
diagnostics, and provenance. Topogram core owns persistence, reconcile,
adoption, and canonical `topo/**` writes.

Use an extractor pack when bundled extraction is too generic for a framework,
language, CLI, database, or UI evidence family. Do not use an extractor pack as
a content template, generator, or adoption plugin. Templates copy starting
Topogram source; generators create runtime/app files from contracts; extractors
read brownfield source and emit review candidates only.

First-party examples include:

- `@topogram/extractor-node-cli` for CLI surfaces;
- `@topogram/extractor-react-router` for React Router UI surfaces;
- `@topogram/extractor-prisma-db` for Prisma schema/migration evidence;
- `@topogram/extractor-express-api` for Express route surfaces;
- `@topogram/extractor-drizzle-db` for Drizzle schema/migration evidence.

## Package Shape

Start with the scaffold when authoring a new pack:

```bash
topogram extractor scaffold ./topogram-extractor-node-cli --track cli --package @scope/topogram-extractor-node-cli
cd ./topogram-extractor-node-cli
npm install
npm run check
```

The scaffold writes the package shape below plus a small fixture and check script.
Use it as disposable starter code; replace the adapter with precise framework
evidence before publishing.

```text
package.json
topogram-extractor.json
index.cjs
AGENTS.md
README.md
scripts/check-extractor.mjs
fixtures/basic-source/
```

The generated `AGENTS.md` is part of the contract for humans and coding agents:
extractors are read-only, do not write canonical `topo/**`, do not install
packages or use the network, and return only review candidates. Shared or
published extractor packs should adopt SDLC in their package repo so those rules,
tasks, and verification proof are queryable. Private one-off extractors may stay
lighter, but they should still follow the generated rules and checks.

`topogram-extractor.json` declares the pack:

```json
{
  "id": "@topogram/extractor-node-cli",
  "version": "1",
  "tracks": ["cli"],
  "source": "package",
  "package": "@topogram/extractor-node-cli",
  "compatibleCliRange": "^0.3.89",
  "stack": { "runtime": "node", "framework": "generic-cli" },
  "capabilities": { "commands": true, "options": true, "effects": true },
  "candidateKinds": ["command", "capability", "cli_surface"],
  "evidenceTypes": ["runtime_source", "parser_config"],
  "extractors": [
    { "id": "cli.node-package", "track": "cli" }
  ]
}
```

The package export returns `{ manifest, extractors }`:

```js
module.exports = {
  manifest,
  extractors: [
    {
      id: "cli.node-package",
      track: "cli",
      detect(context) {
        return { score: 1, reasons: ["Found Node package CLI metadata."] };
      },
      extract(context) {
        return {
          findings: [],
          candidates: {
            commands: [],
            capabilities: [],
            surfaces: []
          },
          diagnostics: []
        };
      }
    }
  ]
};
```

## Adapter Contract

Each extractor adapter is intentionally small. It detects whether it should run,
then returns review-only output:

| Method | Purpose | Must Not |
| --- | --- | --- |
| `detect(context)` | Score whether the extractor has enough source evidence to run. | Mutate source files, install packages, or write `topo/**`. |
| `extract(context)` | Return findings, candidates, diagnostics, and evidence. | Adopt candidates, edit `topogram.project.json`, or define custom adoption semantics. |

The context is read-oriented. Treat source paths, helper reads, source
classification, and configured tracks as evidence inputs. Keep any framework
parsing local to the package and return plain candidate data for Topogram core
to normalize.

Extractor candidate buckets are track-specific:

| Track | Common buckets |
| --- | --- |
| `db` | `entities`, `enums`, `relations`, `indexes`, `maintained_seams` |
| `api` | `capabilities`, `routes`, `stacks` |
| `ui` | `screens`, `routes`, `actions`, `flows`, `widgets`, `shapes`, `stacks` |
| `cli` | `commands`, `capabilities`, `surfaces` |
| `workflows` | `workflows`, `workflow_states`, `workflow_transitions` |
| `verification` | `verifications`, `scenarios`, `frameworks`, `scripts` |

Extractor output is validated before Topogram persists extraction artifacts.
`findings` and `diagnostics` must be arrays when present, and `candidates` must
be an object of track-owned array buckets. Candidate records must have a stable
identity such as `id_hint`, `id`, `name`, or `command_id`; route candidates may
use `method` plus `path`. File evidence must use safe project-relative paths,
not absolute paths or `..` escapes. Candidate output must not include canonical
files, patches, adoption plans, write instructions, or direct `topo/**` writes.
Those are core responsibilities handled only after explicit `topogram adopt`.

`stacks` and `frameworks` are scalar metadata buckets, not adoptable graph
records. Return strings:

```js
return {
  findings: [],
  candidates: {
    capabilities: [{
      id_hint: "cap_get_invoice",
      label: "Get invoice",
      endpoint: { method: "GET", path: "/invoices/{id}" },
      path_params: ["id"],
      query_params: ["includeLines"],
      header_params: ["authorization"],
      input_fields: [],
      output_fields: ["id", "status"],
      provenance: ["src/routes/invoices.ts"]
    }],
    routes: [{ method: "GET", path: "/invoices/{id}", source_kind: "route_code" }],
    stacks: ["express"]
  },
  diagnostics: []
};
```

Common shorthand is accepted at the package boundary. String parameter names are
normalized to parameter records, so `path_params: ["id"]` becomes
`[{ name: "id", required: true, type: null }]`; query and header params default
to `required: false`. `input_fields` and `output_fields` may stay as string field
names. Older stack objects are tolerated temporarily and normalized to strings,
but new extractor packages should emit `stacks: ["express"]`.

## Safety Boundary

- Extractors are read-only.
- Extractors do not write `topo/**`.
- Extractors do not mutate source app files.
- Extractors do not install packages.
- Extractors do not perform network access.
- Extractors do not define adoption semantics.

Core normalizes candidates and writes extraction artifacts. Adoption happens only
through `topogram adopt`.

## Policy And Execution

Bundled `topogram/*` extractors and first-party `@topogram/extractor-*`
packages are allowed by default. Other packages require an explicit
`topogram.extractor-policy.json`.

```bash
topogram extractor policy init
topogram extractor policy pin @topogram/extractor-node-cli@1
topogram extractor policy pin @topogram/extractor-react-router@1
topogram extractor policy pin @topogram/extractor-prisma-db@1
topogram extractor policy pin @topogram/extractor-express-api@1
topogram extractor policy pin @topogram/extractor-drizzle-db@1
topogram extractor policy check
```

No dynamic installation is performed. A package-backed extractor must already be
installed, or you must pass a local package path. Policy pins use the extractor
manifest version, not the npm package version. For example,
`@topogram/extractor-react-router@1` pins manifest version `1`; npm may install
package version `0.1.1` or later.

Use `topogram extractor list` to see bundled packs and first-party package
recommendations grouped by track. Use `topogram extractor recommend <source>`
to inspect a local brownfield source tree and get suggested first-party package
extractors before installing or loading any package code. Use `topogram
extractor show <package>` before installing when you need the package purpose,
install command, policy pin command, npm package version, compatible CLI range,
and a concrete extract command. `topogram extractor check <package>` reports the
same version split: manifest version is what policy pins, package version is
what npm installed, and compatible CLI range is the CLI line the package
declares or inherits.

The consumer command loop is part of the contract:

1. `topogram extractor list` discovers candidates without loading package code.
2. `topogram extractor recommend <source> --from <tracks>` suggests packages from local evidence without loading package code.
3. `topogram extractor show <package>` explains why to use one package, how to install it, how to pin it, what package version is installed, what CLI range is compatible, and how to run extraction.
4. `npm install -D <package>` is explicit; Topogram does not install extractor packages during extraction.
5. `topogram extractor policy pin <package>@<manifest-version>` records the reviewed manifest version.
6. `topogram extractor check <package>` loads package code only for a minimal smoke extraction.
7. `topogram extract ... --extractor <package>` writes candidates and provenance, not canonical records.
8. `topogram extract plan`, `topogram adopt --list`, and `topogram query extract-plan` show package provenance and selectors.
9. `topogram adopt <selector> --dry-run` precedes any `--write`.

Consumer loop:

```bash
npm install -D @topogram/extractor-react-router
topogram extractor policy init
topogram extractor recommend ./react-router-app --from ui
topogram extractor policy pin @topogram/extractor-react-router@1
topogram extractor check @topogram/extractor-react-router
topogram extract ./react-router-app --out ./imported-topogram --from ui --extractor @topogram/extractor-react-router
topogram query extract-plan ./imported-topogram/topo --json
topogram adopt --list ./imported-topogram --json
topogram adopt <selector> ./imported-topogram --dry-run
```

`topogram extractor check` proves the package manifest, export shape, adapter
load, and minimal smoke extraction. It does not prove domain correctness for a
real app. A useful package test must run extraction against a representative
fixture, inspect candidate counts and provenance, run `extract plan`, and dry-run
adoption.

## Author Checks

```bash
topogram extractor scaffold ./my-extractor-pack --track cli --package @scope/my-extractor-pack
npm --prefix ./my-extractor-pack run check
topogram extractor check ./my-extractor-pack
topogram extract ./fixture-app --out /private/tmp/extracted --extractor ./my-extractor-pack
topogram extract plan /private/tmp/extracted --json
topogram adopt --list /private/tmp/extracted --json
topogram query extract-plan /private/tmp/extracted/topo --json
```

Use `TOPOGRAM_CLI` when developing an extractor against a local Topogram checkout:

```bash
TOPOGRAM_CLI=/path/to/topogram/engine/src/cli.js npm --prefix ./my-extractor-pack run check
```

Passing `topogram extractor check` proves the manifest, adapter export, and
minimal smoke shape, including track-aware candidate validation. It does not
replace fixture-based extraction tests.

Package CI should also run a real fixture extraction and inspect the generated
review packet. At minimum, prove:

- `topogram extractor check ./` passes;
- `topogram extract ./fixture-app --out <tmp> --extractor ./` writes candidates;
- `topogram extract plan <tmp> --json` includes the expected candidate groups;
- `topogram query extract-plan <tmp>/topo --json` includes extractor provenance;
- `topogram adopt <selector> <tmp> --dry-run --json` previews canonical writes;
- source fixture files are unchanged.

## Publication Readiness Checklist

Before publishing an extractor package, prove the package boundary from the
outside. The package should be usable by a consumer without reading Topogram
engine internals.

- Scaffold or maintain the standard package shape:
  `topogram-extractor.json`, `index.cjs`, `fixtures/`, `scripts/check-extractor.mjs`,
  package exports, and `files`.
- Run `npm run check` from the extractor package root.
- Pack and install the extractor into a temporary consumer project.
- Run `topogram extractor check <package-or-path>`.
- Run `topogram extract <fixture> --out <tmp> --from <track> --extractor <package-or-path>`.
- Inspect `topogram extract plan <tmp> --json`, `topogram adopt --list <tmp> --json`,
  and `topogram query extract-plan <tmp>/topo --json`.
- Assert expected candidates, candidate counts, extractor provenance, and safety
  notes. Do not accept string-existence-only tests.
- Assert source fixture files are unchanged after extraction.
- Publish only after package CI runs the package smoke against the CLI version in
  `topogram-cli.version`.
- After publish, run the `Package Access` workflow to set public npm access and
  verify `npm view <package> version --registry=https://registry.npmjs.org/`.

Recommended workflows for public first-party-style packages:

```text
.github/workflows/extractor-verification.yml
.github/workflows/publish-package.yml
.github/workflows/package-access.yml
```

## First-Party Examples

Current public first-party extractor package versions at the `@topogram/cli`
`0.3.85` release line:

| Package | Version | Track |
| --- | --- | --- |
| `@topogram/extractor-node-cli` | `0.1.0` | `cli` |
| `@topogram/extractor-react-router` | `0.1.1` | `ui` |
| `@topogram/extractor-prisma-db` | `0.1.0` | `db` |
| `@topogram/extractor-express-api` | `0.1.0` | `api` |
| `@topogram/extractor-drizzle-db` | `0.1.0` | `db` |

```bash
topogram extract ./existing-cli --out ./extracted-cli --from cli --extractor @topogram/extractor-node-cli
topogram extract ./react-router-app --out ./extracted-ui --from ui --extractor @topogram/extractor-react-router
topogram extract ./prisma-app --out ./extracted-db --from db --extractor @topogram/extractor-prisma-db
topogram extract ./express-api --out ./extracted-api --from api --extractor @topogram/extractor-express-api
topogram extract ./drizzle-app --out ./extracted-db --from db --extractor @topogram/extractor-drizzle-db
```

These packages emit review-only candidates. React Router can add screen, route,
non-resource flow, and widget evidence. Prisma and Drizzle can add maintained DB
seam proposals. Express can add route, capability, parameter, auth, and stack
evidence. Adoption is still explicit through `topogram adopt`.
