// @ts-check

import { buildWebRealization } from "../../../realization/ui/index.js";
import { buildDesignIntentCoverage, renderDesignIntentCss } from "./design-intent.js";

function slugify(value) {
  return String(value || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";
}

function titleForScreen(screenId) {
  return String(screenId || "page")
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

function renderStyles(design) {
  return `${renderDesignIntentCss(design)}

:root {
  color: var(--topogram-text-color);
  background: var(--topogram-surface-background);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--topogram-space-unit);
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--topogram-border-color);
  background: var(--topogram-surface-card);
}

.brand {
  color: var(--topogram-text-color);
  font-weight: 700;
  text-decoration: none;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

nav a {
  color: var(--topogram-action-primary-background);
  text-decoration: none;
}

main {
  display: grid;
  gap: var(--topogram-space-unit);
  max-width: 56rem;
  margin: 0 auto;
  padding: var(--topogram-page-padding);
}

.panel {
  border: 1px solid var(--topogram-border-color);
  border-radius: var(--topogram-radius-card);
  background: var(--topogram-surface-card);
  padding: 1.25rem;
}

.muted {
  color: var(--topogram-muted-color);
}

a:focus-visible {
  outline: var(--topogram-focus-outline);
  outline-offset: 2px;
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

function buildVanillaGenerationCoverage(contract, files, routes) {
  const diagnostics = [];
  const designIntent = buildDesignIntentCoverage(contract, files, "styles.css");
  diagnostics.push(...designIntent.diagnostics);
  const screens = routes.map((route) => {
    const contents = files[route.file] || "";
    const rendered = Boolean(contents);
    if (!rendered) {
      diagnostics.push({
        code: "screen_route_not_rendered",
        severity: "error",
        screen: route.screenId,
        route: route.path,
        message: `Screen '${route.screenId}' has route '${route.path}' but no vanilla HTML page was generated.`,
        suggested_fix: "Check the vanilla web generator route emission for this screen."
      });
    }
    return {
      id: route.screenId,
      route: route.path,
      page: route.file,
      rendered,
      renderer: rendered ? "generator" : "missing",
      component_usages: []
    };
  });
  return {
    type: "generation_coverage",
    surface: "web",
    generator: "topogram/vanilla-web",
    projection: {
      id: contract.projection.id,
      name: contract.projection.name,
      platform: contract.projection.platform
    },
    summary: {
      routed_screens: screens.length,
      rendered_screens: screens.filter((screen) => screen.rendered).length,
      implementation_screens: 0,
      generator_screens: screens.filter((screen) => screen.renderer === "generator").length,
      component_usages: 0,
      rendered_component_usages: 0,
      diagnostics: diagnostics.length,
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
    },
    design_intent: designIntent.coverage,
    screens,
    diagnostics
  };
}

function assertGenerationCoverage(coverage) {
  const errors = (coverage.diagnostics || []).filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length === 0) {
    return;
  }
  const details = errors.map((diagnostic) => diagnostic.message).join("; ");
  throw new Error(`Vanilla web generation coverage failed: ${details}`);
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
  const realization = buildWebRealization(graph, options);
  const contract = realization.contract;
  const routeScreens = (contract.screens || []).filter((screen) => Boolean(screen.route));
  const routes = (routeScreens.length > 0 ? routeScreens : [{ id: "home", route: "/", title: "Home" }]).map((screen) => ({
    screenId: screen.id,
    path: screen.route || "/",
    title: screen.title || titleForScreen(screen.id),
    file: routeFileName(screen.route || "/")
  }));
  const nav = routes.map(({ title, file }) => ({ title, file }));
  const files = {
    "package.json": `${JSON.stringify({
      name: contract.projection.id,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "node ./scripts/dev.mjs",
        build: "node ./scripts/build.mjs",
        check: "node ./scripts/check.mjs"
      }
    }, null, 2)}\n`,
    "styles.css": renderStyles(contract.design),
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
        <p>This page was generated from the <code>${contract.projection.id}</code> Topogram web projection.</p>
        <p class="muted">Generated timestamp: <span data-generated-at>pending</span></p>
      </section>`
    });
  });

  const coverage = buildVanillaGenerationCoverage(contract, files, routes);
  assertGenerationCoverage(coverage);
  files["topogram/generation-coverage.json"] = `${JSON.stringify(coverage, null, 2)}\n`;
  files["topogram/ui-web-contract.json"] = `${JSON.stringify(contract, null, 2)}\n`;
  return files;
}
