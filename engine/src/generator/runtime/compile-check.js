import {
  generateServerBundle,
  generateWebBundle,
  getDefaultEnvironmentProjections,
  runtimeUrls
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { mergeBundleFiles } from "./bundle-shared.js";

function buildCompileCheckPlan(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph).runtime.reference;
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  return {
    type: "compile_check_plan",
    name: runtimeReference.compileCheck.name,
    projections: {
      api: apiProjection.id,
      ui: uiProjection.id,
      db: dbProjection.id
    },
    checks: [
      {
        id: "server_typecheck",
        cwd: "server",
        install: "npm install",
        command: "npm run check"
      },
      {
        id: "web_typecheck",
        cwd: "web",
        install: "npm install",
        command: "npm run check"
      },
      {
        id: "web_build",
        cwd: "web",
        install: "npm install",
        command: "npm run build"
      }
    ]
  };
}

function renderCompileCheckEnvExample(graph) {
  const runtimeReference = getExampleImplementation(graph).runtime.reference;
  const urls = runtimeUrls(runtimeReference);
  if (runtimeReference.localDbProjectionId === "proj_db_sqlite") {
    return `DATABASE_URL=./var/${runtimeReference.environment.databaseName || "topogram_app"}.sqlite
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${runtimeReference.demoEnv.userId}
${runtimeReference.environment.envExample || ""}
`;
  }
  return `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${runtimeReference.environment.databaseName || "topogram_app"}?schema=public
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${runtimeReference.demoEnv.userId}
${runtimeReference.environment.envExample || ""}
`;
}

function renderCompileCheckReadme(graph) {
  const runtimeReference = getExampleImplementation(graph).runtime.reference;
  return `# ${runtimeReference.compileCheck.name.replace("Plan", "Bundle")}

This bundle verifies that the generated server and web projects typecheck and build.

## Checks

- server TypeScript check
- web TypeScript check
- web production build

## Usage

1. Copy \`.env.example\` to \`.env\` if needed
2. Run \`bash ./scripts/check.sh\`
`;
}

function renderCompileCheckScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="\${TOPOGRAM_ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

echo "Checking generated server..."
(cd "$ROOT_DIR/server" && npm install && npm run check)

echo "Checking generated web..."
(cd "$ROOT_DIR/web" && npm install && npm run check)

echo "Building generated web..."
(cd "$ROOT_DIR/web" && npm run build)

echo "Compile checks passed."
`;
}

export function generateCompileCheckBundle(graph, options = {}) {
  const plan = buildCompileCheckPlan(graph, options);
  const { apiProjection, uiProjection } = getDefaultEnvironmentProjections(graph, options);
  const files = {
    ".env.example": renderCompileCheckEnvExample(graph),
    "README.md": renderCompileCheckReadme(graph),
    "compile-check-plan.json": `${JSON.stringify(plan, null, 2)}\n`,
    "scripts/check.sh": renderCompileCheckScript()
  };
  const serverBundle = generateServerBundle(graph, apiProjection.id);
  const webBundle = generateWebBundle(graph, uiProjection.id);
  mergeBundleFiles(files, "server", serverBundle);
  mergeBundleFiles(files, "web", webBundle);
  return files;
}

export function generateCompileCheckPlan(graph, options = {}) {
  return buildCompileCheckPlan(graph, options);
}
