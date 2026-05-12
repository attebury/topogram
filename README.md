# Topogram

Topogram is a spec-driven workflow for keeping humans, agents, and generated or
maintained code aligned.

You edit a `topo/` workspace, Topogram validates and resolves it into contracts,
and generators or agents use those contracts to produce or maintain software.

## Install

Use Node 20+.

```bash
npm install --save-dev @topogram/cli
npx topogram doctor
```

## Choose A Workflow

### Generate a new app

```bash
npx topogram template list
npx topogram new ./my-app --template hello-web
cd ./my-app
npm install
npm run agent:brief
npm run doctor
npm run source:status
npm run template:explain
npm run check
npm run generator:policy:check
npm run generate
npm run verify
```

Start here when you want Topogram to create a new generated app from a template.
See [Greenfield Generate](./docs/start/greenfield-generate.md).

### Initialize an existing repo

```bash
npx topogram init . --with-sdlc
topogram check --json
```

Start here when you want an empty maintained Topogram workspace in a repo you
already own. `init` does not copy a template, install generators, or generate
app code. `--with-sdlc` opts the repo into enforced SDLC immediately.

### Import an existing app

```bash
npx topogram import ./existing-app --out ./imported-topogram
cd ./imported-topogram
npx topogram import check
npx topogram import plan
npx topogram import adopt --list
npx topogram check
```

Start here when you want reviewable Topogram candidates from a brownfield app.
Import never mutates the source app. See
[Brownfield Import](./docs/start/brownfield-import.md).

### Start as an agent

```bash
topogram agent brief --json
topogram query list --json
topogram sdlc explain <task-id> --json
```

Start here when an agent needs safe read order, edit boundaries, focused context,
and verification gates. See [Agent First Run](./docs/agent-first-run.md).

## Core Ideas

- `topo/` is the editable Topogram workspace.
- `topogram.project.json` declares outputs, topology runtimes, ownership, ports,
  and generator bindings.
- `topogram check` validates the workspace and project config.
- `topogram generate` writes app/runtime outputs such as `app/`.
- `topogram emit` writes or prints contracts, reports, snapshots, and plans.
- `widget` models reusable semantic UI intent; generators map that intent to
  stack-specific code.
- Templates compose starter Topograms and generator packages. Generator packages
  own stack realization.

## Docs

Use the audience map in [docs/README.md](./docs/README.md).

High-value starting points:

- [Greenfield Generate](./docs/start/greenfield-generate.md)
- [Brownfield Import](./docs/start/brownfield-import.md)
- [Agent First Run](./docs/agent-first-run.md)
- [Topogram Model](./docs/concepts/topogram-model.md)
- [CLI Reference](./docs/reference/cli.md)
- [DSL Reference](./docs/reference/dsl.md)

## Development

This repo owns the CLI, engine, parser, validator, import/adoption workflow,
contracts, generator dispatch, fixtures, tests, and the engine dogfood `topo/`.

```bash
npm install
npm test
bash ./scripts/verify-engine.sh
bash ./scripts/verify-cli-package.sh
```

Maintainer guidance lives under [docs/maintainers](./docs/maintainers/).

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
