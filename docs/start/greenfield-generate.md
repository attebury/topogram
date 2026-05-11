# Greenfield Generate

Use this workflow when Topogram should create a new app or runtime bundle.

## 1. Create a project

```bash
npm install --save-dev @topogram/cli
npx topogram doctor
npx topogram template list
npx topogram new ./my-app --template hello-web
cd ./my-app
npm install
```

`hello-web` is the default small web starter. Other catalog aliases can include
API, database, or native runtimes.

## 2. Inspect the project

```bash
npm run agent:brief
npm run explain
npm run doctor
npm run query:list
```

Read:

1. `AGENTS.md`
2. `README.md`
3. `topogram.project.json`
4. `topo/**`

## 3. Edit the source

Edit `topo/**` for the model and `topogram.project.json` for topology,
ownership, ports, and generator bindings.

Do not treat `app/**` as durable source unless its output ownership is
maintained. Generated-owned outputs are replaceable.

## 4. Validate and generate

```bash
npm run check
npm run generate
npm --prefix app run compile
```

Use the generated project's strongest verification script when it exists:

```bash
npm run verify
```

## 5. Inspect contracts when needed

```bash
topogram emit ui-widget-contract ./topo --json
topogram emit widget-conformance-report ./topo --projection proj_web_surface --json
topogram emit db-schema-snapshot ./topo --projection proj_db --json
```

`emit` is read-only by default. Add `--write --out-dir <dir>` when you want
artifact files.

## Loop

1. Edit `topo/**` or `topogram.project.json`.
2. Run `topogram check`.
3. Run focused widget/query/SDLC checks when relevant.
4. Run `topogram generate`.
5. Compile or run the generated output.
