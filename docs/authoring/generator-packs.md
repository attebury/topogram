# Generator Packs

Generator packages turn normalized Topogram contracts into stack-specific files.

## Manifest

`topogram-generator.json`:

```json
{
  "id": "@topogram/generator-react-web",
  "version": "1",
  "surface": "web",
  "projectionTypes": ["web_surface"],
  "inputs": ["ui-surface-contract", "api-contracts"],
  "outputs": ["web-app", "generation-coverage"],
  "stack": {
    "runtime": "browser",
    "framework": "react",
    "language": "typescript"
  },
  "capabilities": {
    "routes": true,
    "widgets": true,
    "coverage": true
  },
  "widgetSupport": {
    "patterns": ["resource_table", "data_grid_view"],
    "behaviors": ["selection", "sorting"],
    "unsupported": "warning"
  },
  "source": "package",
  "package": "@topogram/generator-react-web"
}
```

## Adapter export

Publish a CommonJS-compatible entry:

```js
exports.manifest = require("./topogram-generator.json");

exports.generate = function generate(context) {
  return {
    files: {},
    artifacts: {},
    diagnostics: []
  };
};
```

Use `context.runtime` and `context.contracts` as the primary API. Raw projection
internals are compatibility fallback, not the preferred contract.

## Verify

```bash
topogram generator check .
npm run check
```

Generator CI should pack/install the generator, run `topogram check`, run
`topogram generate`, and compile or check the generated output when the stack
supports it.
