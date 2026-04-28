# Product Workflow

The current workflow is:

1. edit `demos/generated/todo-demo-app/topogram/`
2. validate the Topogram
3. generate app artifacts
4. compile or smoke-check the generated app
5. repeat

For first use, run:

```bash
cd engine
npm test
cd ../demos/generated/todo-demo-app
npm install
npm run topogram:validate
npm run topogram:generate
npm run app:compile
```

Run `npm run app:smoke` and `npm run app:runtime-check` when local services are ready.

For folder ownership, see [Topogram Workspace Layout](./topogram-workspace-layout.md).
