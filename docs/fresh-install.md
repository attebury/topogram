# Fresh Install

This page moved to [Greenfield Generate](./start/greenfield-generate.md).

Current short path:

```bash
npm install --save-dev @topogram/cli
npx topogram doctor
npx topogram template list
npx topogram new ./my-app --template hello-web
cd ./my-app
npm install
npm run check
npm run generate
npm --prefix app run compile
```

Use `topogram init .` instead of `topogram new` when the repository already
exists and you want Topogram to track it as maintained source without copying a
template or generating app code.
