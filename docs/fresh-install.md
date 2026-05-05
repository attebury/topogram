# Fresh Install

Use this path when starting from npmjs, outside a Topogram source checkout.

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

`hello-web` is the default public catalog starter. It resolves through the
public `attebury/topograms` catalog to a versioned `@topogram/starter-*`
package, then generates a vanilla web app.

Use a different catalog alias when you want a different starting stack:

```bash
npx topogram template list
npx topogram new ./web-api --template web-api
```

Run `npx topogram doctor` first when package or catalog access fails.
