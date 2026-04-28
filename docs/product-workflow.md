# Product Workflow

The current workflow is:

1. edit `examples/generated/todo/topogram/`
2. validate the Topogram
3. generate app artifacts
4. compile or smoke-check the generated app
5. repeat

For first use, run:

```bash
cd engine
npm test
cd ../examples/generated/todo/apps/local-stack
npm run compile
```

Run `bash ./scripts/verify-generated-example.sh todo compile-smoke` from the repo root when local services are ready.

For folder ownership, see [Topogram Workspace Layout](./topogram-workspace-layout.md).
