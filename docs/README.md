# Topogram Docs

These docs are organized by audience. Historical docs were archived to
`topogram-project` on 2026-05-11 and are not the current source of truth.

## I Want To...

| Goal | Start Here |
| --- | --- |
| Initialize Topogram in an existing repo | [Initialize Maintained Repo](./start/init-maintained.md) |
| Generate a new app | [Greenfield Generate](./start/greenfield-generate.md) |
| Extract an existing app | [Brownfield Extract/Adopt](./start/brownfield-import.md) |
| Maintain database migrations | [Database Migrations](./start/database-migrations.md) |
| Work as an agent | [Agent First Run](./agent-first-run.md) |
| Understand the model | [Topogram Model](./concepts/topogram-model.md) |
| Understand `topo/` ownership | [Topo Workspace](./concepts/topo-workspace.md) |
| Choose between `generate` and `emit` | [Generate vs Emit](./concepts/generate-vs-emit.md) |
| Author templates | [Template Authoring](./authoring/templates.md) |
| Author generator packages | [Generator Packs](./authoring/generator-packs.md) |
| Use or author extractor packages | [Extractor Packs](./authoring/extractor-packs.md) |
| Inspect runnable proof stories | [Proof Walkthrough](./proof-walkthrough.md) |
| Maintain this repo | [Engine Development](./maintainers/engine-development.md) |
| Maintain docs | [Documentation Maintenance](./maintainers/docs.md) |

## Proof Repositories

Use the public proof repos when you want to inspect complete, runnable workflow
stories instead of isolated command examples:

- [Proof Walkthrough](./proof-walkthrough.md)
- [Generated To Maintained Proof](https://github.com/attebury/topogram-proof-content-approval-v2)
- [Brownfield Extract/Adopt Proof](https://github.com/attebury/topogram-proof-content-approval-brownfield-v2)

## Reference

- [SvelteKit / maintained UI realization (design reference)](./design/sveltekit-realization-shape.md)
- [CLI Reference](./reference/cli.md)
- [DSL Reference](./reference/dsl.md)
- [Project Config](./reference/project-config.md)
- [Extract/Adopt JSON](./reference/import-json.md)
- [Widgets](./widgets.md)
- [SDLC](./concepts/sdlc.md)

## Current Terms

- Workspace folder: `topo/`
- Project config: `topogram.project.json`
- Reusable UI contract: `widget`
- App output command: `topogram generate`
- Artifact command: `topogram emit`
- Brownfield discovery command: `topogram extract`
- Topology entries: `topology.runtimes`
- Runtime kinds: `web_surface`, `api_service`, `database`, `ios_surface`,
  `android_surface`
