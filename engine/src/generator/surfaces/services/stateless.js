// @ts-check

import { getProjection } from "../shared.js";

function renderPackageJson(profile) {
  const dependencies = profile === "express"
    ? { express: "^5.1.0" }
    : { hono: "^4.6.14", "@hono/node-server": "^1.13.7" };
  const devDependencies = profile === "express"
    ? { "@types/express": "^5.0.0", "@types/node": "^22.10.2", tsx: "^4.19.2", typescript: "^5.6.3" }
    : { "@types/node": "^22.10.2", tsx: "^4.19.2", typescript: "^5.6.3" };
  return `${JSON.stringify({
    private: true,
    type: "module",
    scripts: {
      dev: "tsx src/index.ts",
      check: "tsc --noEmit",
      start: "node dist/index.js"
    },
    dependencies,
    devDependencies
  }, null, 2)}\n`;
}

function renderTsconfig() {
  return `${JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "dist"
    },
    include: ["src/**/*.ts"]
  }, null, 2)}\n`;
}

function routePath(path) {
  return String(path || "/").replace(/:([A-Za-z0-9_]+)/g, ":$1");
}

function renderHonoIndex(projection) {
  const routes = (projection.http || []).map((route) => {
    const method = String(route.method || "GET").toLowerCase();
    return `app.${method}("${routePath(route.path)}", (c) => c.json({ ok: true, capability: "${route.capabilityId}", input: { params: c.req.param(), query: c.req.query() } }, ${route.success || 200} as any));`;
  }).join("\n");
  return `import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "${projection.id}" }));
app.get("/ready", (c) => c.json({ ok: true, ready: true, service: "${projection.id}" }));
${routes}

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port });
console.log(\`${projection.id} listening on http://localhost:\${port}\`);
`;
}

function expressPath(path) {
  return routePath(path);
}

function renderExpressIndex(projection) {
  const routes = (projection.http || []).map((route) => {
    const method = String(route.method || "GET").toLowerCase();
    return `app.${method}("${expressPath(route.path)}", (req, res) => res.status(${route.success || 200}).json({ ok: true, capability: "${route.capabilityId}", input: { params: req.params, query: req.query } }));`;
  }).join("\n");
  return `import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "${projection.id}" }));
app.get("/ready", (_req, res) => res.json({ ok: true, ready: true, service: "${projection.id}" }));
${routes}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(\`${projection.id} listening on http://localhost:\${port}\`);
});
`;
}

export function generateStatelessServer(graph, options = {}) {
  const projection = getProjection(graph, options.projectionId);
  const profile = options.profile === "express" ? "express" : "hono";
  return {
    "package.json": renderPackageJson(profile),
    "tsconfig.json": renderTsconfig(),
    "src/index.ts": profile === "express" ? renderExpressIndex(projection) : renderHonoIndex(projection)
  };
}
