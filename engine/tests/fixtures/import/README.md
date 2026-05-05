These are small, actively tested importer smoke fixtures for the engine.

Retained fixtures:

- `prisma-openapi`: Prisma schema plus OpenAPI JSON.
- `sql-openapi`: SQL schema plus OpenAPI YAML.
- `route-fallback`: generic route-code fallback plus React Router screens.

The old broad brownfield fixture corpus was moved to:

```text
topogram-project/project/topogram/deferred-code/import-fixtures/
```

Do not add large source snapshots here. Engine import fixtures should stay
small, targeted, and covered by `engine/tests/active/import-fixtures.test.js`.
