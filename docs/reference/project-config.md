# Project Config

`topogram.project.json` declares how a project uses a `topo/` workspace.

Minimal shape:

```json
{
  "version": "1",
  "workspace": "./topo",
  "outputs": [
    {
      "id": "app",
      "path": "./app",
      "ownership": "generated"
    }
  ],
  "topology": {
    "runtimes": []
  }
}
```

## Workspace

`workspace` defaults to `./topo`. It must be relative and cannot escape the
project root. Package fixtures may use `"."`.

## Outputs

Outputs are either:

- `generated`: Topogram may replace the output when the generated sentinel is
  present.
- `maintained`: Topogram never overwrites it; emit contracts/reports instead.

## Runtimes

Runtime kinds:

- `web_surface`
- `api_service`
- `database`
- `ios_surface`
- `android_surface`

References:

- `uses_api` links web/native surfaces to an API runtime.
- `uses_database` links API services to a database runtime.

Each runtime can bind a package-backed or bundled generator.
