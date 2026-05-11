# Generators

Topogram core owns contracts. Generator packages own stack realization.

Before generation, Topogram validates topology, resolves the graph, builds
normalized contracts, and selects the generator bound to each runtime in
`topogram.project.json`.

## Runtime to generator

```json
{
  "id": "app_web",
  "kind": "web_surface",
  "projection": "proj_web_surface",
  "generator": {
    "id": "@topogram/generator-react-web",
    "version": "1",
    "package": "@topogram/generator-react-web"
  },
  "uses_api": "app_api",
  "port": 5173
}
```

The project must install package-backed generators before `check` or
`generate` can load them.

## Inspect

```bash
topogram generator list
topogram generator show @topogram/generator-react-web
topogram generator check ./generator-package
topogram generator policy check
```

Generator policy controls which package-backed generators may execute.

## Contracts by surface

- Web generators receive `ui-surface-contract` and related API contracts.
- API generators receive server/API contracts and optional database runtime
  context.
- Database generators receive DB contract and lifecycle plan.
- Native generators receive routed UI contracts and related API contracts.
