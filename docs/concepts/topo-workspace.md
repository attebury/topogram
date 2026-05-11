# Topo Workspace

`topo/` is the default Topogram workspace folder.

```text
my-app/
  topo/
  topogram.project.json
  package.json
  app/
```

`topo/` is source. `app/` is generated output unless
`topogram.project.json` marks that output as maintained.

## Resolution

Commands default to `./topo`. If a command starts from another path, Topogram
looks for `topogram.project.json` and uses its `workspace` field.

Valid project config:

```json
{
  "version": "1",
  "workspace": "./topo",
  "outputs": [],
  "topology": {
    "runtimes": []
  }
}
```

`workspace` must be relative and must not escape the project root. Some package
fixtures use `"workspace": "."`.

## Suggested folders

Small projects can stay flat. Larger projects should group files for humans and
agents:

```text
topo/
  domains/
  shared/
  sdlc/
    pitches/
    requirements/
    acceptance_criteria/
    tasks/
    plans/
    bugs/
    decisions/
  widgets/
  projections/
  verifications/
  docs/
```

Folder layout is not semantic by itself. References inside statements are the
source of truth.
