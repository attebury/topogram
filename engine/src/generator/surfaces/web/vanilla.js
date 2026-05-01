// @ts-check

import { getProjection } from "../shared.js";

function slugify(value) {
  return String(value || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";
}

function titleForScreen(graph, screenId) {
  for (const projection of graph.byKind.projection || []) {
    const screen = (projection.uiScreens || []).find((entry) => entry.id === screenId);
    if (screen?.title) {
      return screen.title;
    }
  }
  return screenId
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function routeFileName(routePath) {
  if (!routePath || routePath === "/") {
    return "index.html";
  }
  return `${slugify(routePath)}.html`;
}

function renderHtml({ title, nav, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header class="app-header">
      <a class="brand" href="./index.html">Topogram Hello</a>
      <nav>
${nav.map((item) => `        <a href="./${item.file}">${item.title}</a>`).join("\n")}
      </nav>
    </header>
    <main>
${body}
    </main>
    <script src="./app.js" type="module"></script>
  </body>
</html>
`;
}

function renderStyles() {
  return `:root {
  color: #182026;
  background: #f6f8fb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #d8e0ea;
  background: #ffffff;
}

.brand {
  color: #182026;
  font-weight: 700;
  text-decoration: none;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

nav a {
  color: #0f5cc0;
  text-decoration: none;
}

main {
  display: grid;
  gap: 1rem;
  max-width: 56rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

.panel {
  border: 1px solid #d8e0ea;
  border-radius: 8px;
  background: #ffffff;
  padding: 1.25rem;
}

.muted {
  color: #607284;
}
`;
}

function renderBrowserScript() {
  return `const stamp = document.querySelector("[data-generated-at]");
if (stamp) {
  stamp.textContent = new Date().toLocaleString();
}
`;
}

function renderBuildScript() {
  return `import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && [".html", ".css", ".js"].includes(path.extname(entry.name))) {
    fs.copyFileSync(path.join(root, entry.name), path.join(dist, entry.name));
  }
}
console.log("Built vanilla web app to dist/.");
`;
}

function renderCheckScript() {
  return `import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const htmlFiles = fs.readdirSync(root).filter((entry) => entry.endsWith(".html"));
if (htmlFiles.length < 1) {
  throw new Error("Expected at least one HTML page.");
}
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  if (!html.includes("<main>") || !html.includes("./styles.css") || !html.includes("./app.js")) {
    throw new Error(\`\${file} is missing the expected page shell.\`);
  }
}
console.log(\`Checked \${htmlFiles.length} vanilla page(s).\`);
`;
}

function renderDevScript() {
  return `import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const port = Number(process.env.PORT || process.env.WEB_PORT || 5173);
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"]
]);

http.createServer((req, res) => {
  const url = new URL(req.url || "/", \`http://localhost:\${port}\`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": types.get(path.extname(filePath)) || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(\`Vanilla web app listening on http://localhost:\${port}\`);
});
`;
}

export function generateVanillaWebApp(graph, options = {}) {
  const projection = getProjection(graph, options.projectionId);
  const routeEntries = projection.uiRoutes?.length
    ? projection.uiRoutes
    : [{ screenId: "home", path: "/" }];
  const routes = routeEntries.map((route) => ({
    screenId: route.screenId,
    path: route.path,
    title: titleForScreen(graph, route.screenId),
    file: routeFileName(route.path)
  }));
  const nav = routes.map(({ title, file }) => ({ title, file }));
  const files = {
    "package.json": `${JSON.stringify({
      name: projection.id,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "node ./scripts/dev.mjs",
        build: "node ./scripts/build.mjs",
        check: "node ./scripts/check.mjs"
      }
    }, null, 2)}\n`,
    "styles.css": renderStyles(),
    "app.js": renderBrowserScript(),
    "scripts/build.mjs": renderBuildScript(),
    "scripts/check.mjs": renderCheckScript(),
    "scripts/dev.mjs": renderDevScript()
  };

  routes.forEach((route, index) => {
    files[route.file] = renderHtml({
      title: route.title,
      nav,
      body: `      <section class="panel">
        <p class="muted">Page ${index + 1} of ${routes.length}</p>
        <h1>${route.title}</h1>
        <p>This page was generated from the <code>${projection.id}</code> Topogram web projection.</p>
        <p class="muted">Generated timestamp: <span data-generated-at>pending</span></p>
      </section>`
    });
  });

  return files;
}
