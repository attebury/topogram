import {
  generateServerBundle,
  generateWebBundle,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology,
  runtimeUrls
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { mergeBundleFiles } from "./bundle-shared.js";

function buildCompileCheckPlan(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const apiChecks = topology.apiComponents.map((component, index) => ({
    id: index === 0 ? "server_typecheck" : `server_typecheck_${component.id}`,
    cwd: topology.serviceDir(component),
    install: "npm install",
    command: "npm run check"
  }));
  const webChecks = topology.webComponents.flatMap((component, index) => [
    {
      id: index === 0 ? "web_typecheck" : `web_typecheck_${component.id}`,
      cwd: topology.webDir(component),
      install: "npm install",
      command: "npm run check"
    },
    {
      id: index === 0 ? "web_build" : `web_build_${component.id}`,
      cwd: topology.webDir(component),
      install: "npm install",
      command: "npm run build"
    }
  ]);
  return {
    type: "compile_check_plan",
    name: runtimeReference.compileCheck.name,
    projections: {
      api: apiProjection.id,
      ui: uiProjection.id,
      db: dbProjection.id
    },
    topology: {
      components: topology.components.map((component) => ({
        id: component.id,
        type: component.type,
        projection: component.projection.id,
        generator: component.generator
      }))
    },
    checks: [...apiChecks, ...webChecks]
  };
}

function renderCompileCheckEnvExample(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const topology = resolveRuntimeTopology(graph, options);
  const urls = runtimeUrls(runtimeReference, topology);
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

function renderCompileCheckReadme(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
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

function renderCompileCheckScript(plan) {
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"',
    'ENV_FILE="${TOPOGRAM_ENV_FILE:-$ROOT_DIR/.env}"',
    "",
    'if [[ -f "$ENV_FILE" ]]; then',
    "  set -a",
    '  . "$ENV_FILE"',
    "  set +a",
    "fi",
    ""
  ];
  for (const check of plan.checks) {
    const label = check.id.includes("web")
      ? check.id.includes("build") ? "Building generated web" : "Checking generated web"
      : "Checking generated server";
    lines.push(`echo "${label} (${check.cwd})..."`);
    lines.push(`(cd "$ROOT_DIR/${check.cwd}" && ${check.install} && ${check.command})`);
    lines.push("");
  }
  lines.push('echo "Compile checks passed."');
  return `${lines.join("\n")}\n`;
}

export function generateCompileCheckBundle(graph, options = {}) {
  const plan = buildCompileCheckPlan(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const files = {
    ".env.example": renderCompileCheckEnvExample(graph, options),
    "README.md": renderCompileCheckReadme(graph, options),
    "compile-check-plan.json": `${JSON.stringify(plan, null, 2)}\n`,
    "scripts/check.sh": renderCompileCheckScript(plan)
  };
  for (const component of topology.apiComponents) {
    const serverBundle = generateServerBundle(graph, component.projection.id, { ...options, component });
    mergeBundleFiles(files, topology.serviceDir(component), serverBundle);
  }
  for (const component of topology.webComponents) {
    const webBundle = generateWebBundle(graph, component.projection.id, { ...options, component });
    mergeBundleFiles(files, topology.webDir(component), webBundle);
  }
  return files;
}

export function generateCompileCheckPlan(graph, options = {}) {
  return buildCompileCheckPlan(graph, options);
}
