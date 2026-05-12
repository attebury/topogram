# Templates And Catalog

Templates create starter projects. The catalog maps stable names to versioned
packages.

## Discover

```bash
topogram template list
topogram copy --list
topogram catalog list
topogram catalog show hello-web
```

## Create from a template

```bash
topogram copy hello-web ./my-app
topogram copy todo ./todo-app
topogram copy @scope/template-package ./my-app
topogram copy ../local-template ./my-app
```

`topogram copy` copies template files, writes project metadata, and installs no
package lifecycle scripts. If a template includes executable `implementation/`
code, the generated project records trust metadata. Generation can be blocked
until that implementation is reviewed and trusted.

Template-created projects use template metadata, not pure Topogram source
provenance. Use:

```bash
topogram template explain
topogram template status
topogram trust status
```

Generated projects may contain `.topogram-template-files.json` as the reviewed
template baseline. They normally do not contain `.topogram-source.json`; that
file belongs to pure Topogram catalog copies.

## Copy a pure Topogram

```bash
topogram copy hello ./hello-topogram
cd ./hello-topogram
topogram source status --local
topogram check
```

Pure Topogram packages contain source for editing. They do not contain
executable `implementation/` code. `catalog copy` records `.topogram-source.json`
so `topogram source status --local` can compare the copied files against their
catalog package source.

## Health

```bash
topogram doctor
topogram catalog doctor
topogram source status --local
topogram source status --remote
```

Public `@topogram/*` packages install from npmjs. Private package consumers use
their registry's normal npm auth.
