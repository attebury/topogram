# Topogram Docs

These docs are organized by audience. Historical docs were archived to
`topogram-project` on 2026-05-11 and are not the current source of truth.

## I Want To...

| Goal | Start Here |
| --- | --- |
| Generate a new app | [Greenfield Generate](./start/greenfield-generate.md) |
| Import an existing app | [Brownfield Import](./start/brownfield-import.md) |
| Maintain database migrations | [Database Migrations](./start/database-migrations.md) |
| Work as an agent | [Agent First Run](./agent-first-run.md) |
| Understand the model | [Topogram Model](./concepts/topogram-model.md) |
| Understand `topo/` ownership | [Topo Workspace](./concepts/topo-workspace.md) |
| Choose between `generate` and `emit` | [Generate vs Emit](./concepts/generate-vs-emit.md) |
| Author templates | [Template Authoring](./authoring/templates.md) |
| Author generator packages | [Generator Packs](./authoring/generator-packs.md) |
| Maintain this repo | [Engine Development](./maintainers/engine-development.md) |
| Maintain docs | [Documentation Maintenance](./maintainers/docs.md) |

## Reference

- [CLI Reference](./reference/cli.md)
- [DSL Reference](./reference/dsl.md)
- [Project Config](./reference/project-config.md)
- [Import JSON](./reference/import-json.md)
- [Widgets](./widgets.md)
- [SDLC](./concepts/sdlc.md)

## Current Terms

- Workspace folder: `topo/`
- Project config: `topogram.project.json`
- Reusable UI contract: `widget`
- App output command: `topogram generate`
- Artifact command: `topogram emit`
- Topology entries: `topology.runtimes`
- Runtime kinds: `web_surface`, `api_service`, `database`, `ios_surface`,
  `android_surface`
