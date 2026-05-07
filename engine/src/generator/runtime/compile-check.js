import {
  generateServerBundle,
  generateWebBundle,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology,
  runtimeDemoUserId,
  runtimeUrls
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { mergeBundleFiles } from "./bundle-shared.js";

function compileCheckName(graph, options = {}) {
  try {
    return getExampleImplementation(graph, options).runtime.reference.compileCheck.name;
  } catch {
    return "Topogram Compile Check";
  }
}

function runtimeReferenceFor(graph, options = {}) {
  try {
    return getExampleImplementation(graph, options).runtime.reference;
  } catch {
    return { environment: { databaseName: "topogram_app", envExample: "" }, demoEnv: { userId: "" }, ports: { server: 3000, web: 5173 } };
  }
}

function buildCompileCheckPlan(graph, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const apiChecks = topology.apiComponents.map((component, index) => ({
    id: index === 0 ? "server_typecheck" : `server_typecheck_${component.id}`,
    cwd: topology.serviceDir(component),
    install: "npm install --no-audit --no-fund",
    command: "npm run check"
  }));
  const webChecks = topology.webComponents.flatMap((component, index) => [
    {
      id: index === 0 ? "web_typecheck" : `web_typecheck_${component.id}`,
      cwd: topology.webDir(component),
      install: "npm install --no-audit --no-fund",
      command: "npm run check"
    },
    {
      id: index === 0 ? "web_build" : `web_build_${component.id}`,
      cwd: topology.webDir(component),
      install: "npm install --no-audit --no-fund",
      command: "npm run build"
    }
  ]);
  return {
    type: "compile_check_plan",
    name: compileCheckName(graph, options),
    projections: {
      api: apiProjection?.id || null,
      ui: uiProjection?.id || null,
      db: dbProjection?.id || null
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
  const runtimeReference = runtimeReferenceFor(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const { dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const urls = runtimeUrls(runtimeReference, topology);
  if (dbProjection?.platform === "db_sqlite") {
    return `DATABASE_URL=./var/${runtimeReference.environment.databaseName || "topogram_app"}.sqlite
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${runtimeDemoUserId(runtimeReference)}
${runtimeReference.environment.envExample || ""}
`;
  }
  return `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${runtimeReference.environment.databaseName || "topogram_app"}?schema=public
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${runtimeDemoUserId(runtimeReference)}
${runtimeReference.environment.envExample || ""}
`;
}

function renderCompileCheckReadme(graph, options = {}) {
  return `# ${compileCheckName(graph, options).replace("Plan", "Bundle")}

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
  if (plan.checks.length === 0) {
    lines.push('echo "No API or web components are configured; compile check is a no-op."');
  }
  for (const check of plan.checks) {
    const label = check.id.includes("web")
      ? check.id.includes("build") ? "Building generated web" : "Checking generated web"
      : "Checking generated server";
    lines.push(`echo "${label} (${check.cwd})..."`);
    lines.push(`echo "Installing dependencies (${check.cwd})..."`);
    lines.push(`(cd "$ROOT_DIR/${check.cwd}" && ${check.install})`);
    lines.push(`echo "Running ${check.command} (${check.cwd})..."`);
    lines.push(`(cd "$ROOT_DIR/${check.cwd}" && ${check.command})`);
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
