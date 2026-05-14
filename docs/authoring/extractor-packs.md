# Extractor Packs

Extractor packs are package-backed brownfield discovery extensions. They are
the extraction counterpart to generator packs, but their contract is narrower:
they read source evidence and emit review-only findings, candidates,
diagnostics, and provenance. Topogram core owns persistence, reconcile,
adoption, and canonical `topo/**` writes.

Use an extractor pack when bundled extraction is too generic for a framework,
language, CLI, database, or UI evidence family. First-party examples include:

- `@topogram/extractor-node-cli` for CLI surfaces;
- `@topogram/extractor-react-router` for React Router UI surfaces;
- `@topogram/extractor-prisma-db` for Prisma schema/migration evidence;
- `@topogram/extractor-express-api` for Express route surfaces;
- `@topogram/extractor-drizzle-db` for Drizzle schema/migration evidence.

## Package Shape

```text
package.json
topogram-extractor.json
index.cjs
README.md
scripts/check-extractor.mjs
```

`topogram-extractor.json` declares the pack:

```json
{
  "id": "@topogram/extractor-node-cli",
  "version": "1",
  "tracks": ["cli"],
  "source": "package",
  "package": "@topogram/extractor-node-cli",
  "stack": { "runtime": "node", "framework": "generic-cli" },
  "capabilities": ["commands", "options", "effects"],
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

## Safety Boundary

- Extractors are read-only.
- Extractors do not write `topo/**`.
- Extractors do not mutate source app files.
- Extractors do not install packages.
- Extractors do not perform network access.
- Extractors do not define adoption semantics.

Core normalizes candidates and writes extraction artifacts. Adoption happens only
through `topogram adopt`.

## Policy

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
installed, or you must pass a local package path.

Use `topogram extractor list` to see bundled packs and first-party package
recommendations grouped by track. Use `topogram extractor show <package>` before
installing when you need the package purpose, install command, policy pin
command, and a concrete extract command.

## Author Checks

```bash
topogram extractor check ./my-extractor-pack
topogram extract ./fixture-app --out /private/tmp/extracted --extractor ./my-extractor-pack
topogram extract plan /private/tmp/extracted --json
topogram adopt --list /private/tmp/extracted --json
topogram query extract-plan /private/tmp/extracted/topo --json
```

Passing `topogram extractor check` proves the manifest, adapter export, and
minimal smoke shape. It does not replace fixture-based extraction tests.

Package CI should also run a real fixture extraction and inspect the generated
review packet. At minimum, prove:

- `topogram extractor check ./` passes;
- `topogram extract ./fixture-app --out <tmp> --extractor ./` writes candidates;
- `topogram extract plan <tmp> --json` includes the expected candidate groups;
- `topogram query extract-plan <tmp>/topo --json` includes extractor provenance;
- `topogram adopt <selector> <tmp> --dry-run --json` previews canonical writes;
- source fixture files are unchanged.

## First-Party Examples

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
