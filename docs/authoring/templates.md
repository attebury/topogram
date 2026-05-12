# Template Authoring

Template packages are starter projects for `topogram copy`.

## Required layout

```text
topogram-template.json
topo/
topogram.project.json
implementation/        # optional executable customization
package.json           # required for npm packages
```

`topogram-template.json`:

```json
{
  "id": "@scope/template-name",
  "version": "0.1.0",
  "kind": "starter",
  "topogramVersion": "0.1",
  "includesExecutableImplementation": false
}
```

Use `includesExecutableImplementation: true` when the template copies
`implementation/` code that may run later during `topogram generate`.

## Package payload

Keep package files narrow:

```json
{
  "files": [
    "topogram-template.json",
    "topo",
    "topogram.project.json",
    "implementation",
    "README.md"
  ]
}
```

Do not publish consumer metadata such as `.topogram-template-trust.json` or
`.topogram-template-files.json`.

## Trust

`topogram copy` copies implementation code but does not execute it. Generated
projects record implementation hashes. Review code before running
`topogram trust template`.

Template packs must not contain symlinks under `topo/`,
`topogram.project.json`, or `implementation/`.

## Verify

```bash
topogram template check ./my-template
topogram copy ./my-template ./scratch
cd ./scratch
npm install
npm run check
npm run generate
npm run verify
```

Template tests should run the generated project's meaningful verification
surface, not only check that files exist.
