# Todo Demo App

This is the canonical generated app demo for the current Topogram workflow.

The demo is intentionally shaped like a user project:

- `topogram/` is the authored Topogram workspace
- `app/` is the generated local app bundle
- `package.json` exposes the authoring-to-app commands

## Workflow

Install dependencies once:

```bash
npm install
```

Validate the Topogram:

```bash
npm run explain
npm run status
```

Generate the app bundle:

```bash
npm run build
```

Bootstrap and run the generated app:

```bash
npm run bootstrap
npm run dev
```

Run verification:

```bash
npm run verify
npm run app:smoke
npm run app:runtime-check
```

For normal iteration, edit files under `topogram/`, regenerate with `npm run build`, then rerun the relevant app checks.
