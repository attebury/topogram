# Extractor Packs

Extractor packs are package-backed brownfield discovery extensions. They are
the extraction counterpart to generator packs, but their contract is narrower:
they read source evidence and emit review-only findings, candidates,
diagnostics, and provenance. Topogram core owns persistence, reconcile,
adoption, and canonical `topo/**` writes.

Use an extractor pack when bundled extraction is too generic for a framework,
language, CLI, database, or UI evidence family.

## Package Shape

```text
package.json
topogram-extractor.json
index.cjs
README.md
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
topogram extractor policy check
```

No dynamic installation is performed. A package-backed extractor must already be
installed, or you must pass a local package path.

## Author Checks

```bash
topogram extractor check ./my-extractor-pack
topogram extract ./fixture-app --out /private/tmp/extracted --extractor ./my-extractor-pack
topogram extract plan /private/tmp/extracted --json
topogram adopt --list /private/tmp/extracted --json
```

Passing `topogram extractor check` proves the manifest, adapter export, and
minimal smoke shape. It does not replace fixture-based extraction tests.
