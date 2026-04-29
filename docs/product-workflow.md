# Product Workflow

The current greenfield workflow is:

1. run `topogram new ./my-app`
2. edit `topogram/` and `topogram.project.json`
3. run `topogram check ./topogram`
4. run `topogram generate ./topogram --out ./app`
5. compile or smoke-check the generated app
6. repeat

`topogram.project.json` owns stack and topology choices. It binds generated or maintained outputs, API/web/database components, ports, and generator IDs. Generated outputs can be regenerated when `.topogram-generated.json` is present; maintained outputs are not overwritten.

Maintained apps use the same check step, then emit contracts, checks, reports, or migration proposals while an agent or human edits the app code directly.

Brownfield apps import into candidate Topogram artifacts first, then the candidate is reviewed, adopted, checked, and either generated into a new stack or treated as maintained.

For first use, run:

```bash
cd engine
npm install
npm run new -- ../my-topogram-app
cd ../my-topogram-app
npm install
npm run check
npm run generate
npm run verify
```

Run `npm run app:smoke` and `npm run app:runtime-check` when local services are ready.

For folder ownership, see [Topogram Workspace Layout](./topogram-workspace-layout.md).
