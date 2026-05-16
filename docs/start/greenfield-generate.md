# Greenfield Generate

Use this workflow when Topogram should create a new app or runtime bundle.

Start with [Initialize Maintained Repo](./init-maintained.md) instead when you
want an empty maintained Topogram workspace in an existing repo and do not want
to copy a starter template.

## 1. Create a project

```bash
npm install --save-dev @topogram/cli
npx topogram doctor
npx topogram template list
npx topogram copy hello-web ./my-app
cd ./my-app
npm install
```

`hello-web` is the default small web starter. Other catalog aliases can include
API, database, or native runtimes.

For a blank maintained workspace:

```bash
npx topogram init ./existing-or-empty-repo --adopt-sdlc
cd ./existing-or-empty-repo
topogram check --json
```

`init` writes `topo/` and `topogram.project.json` only. It does not copy a
template, install generators, or generate app code. `--adopt-sdlc` also writes
`topogram.sdlc-policy.json` with adopted/enforced defaults.

## 2. Inspect the project

```bash
npm run agent:brief
npm run explain
npm run doctor
npm run source:status
npm run template:explain
npm run generator:policy:status
npm run generator:policy:check
npm run query:list
```

`source:status` may report no pure Topogram source provenance for projects
created from templates. For template-created projects, `template:explain`,
`template:status`, and trust commands are the relevant template lifecycle
surfaces.

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
npm run verify
```

`npm run verify` is the generated project's strongest standard verification
script. If a generated app exposes lower-level app scripts, they remain useful
for focused debugging:

```bash
npm run app:compile
npm run app:runtime
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
