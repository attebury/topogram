import {
  buildVerificationSummary,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology,
  runtimeUrls,
  selectChecksByVerification
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";

function buildRuntimeSmokePlan(graph, options = {}) {
  const implementation = getExampleImplementation(graph, options);
  const runtimeReference = implementation.runtime.reference;
  const runtimeChecks = implementation.runtime.checks;
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection } = getDefaultEnvironmentProjections(graph, options);
  const verification = buildVerificationSummary(graph, ["smoke", "journey"]);
  const smokeSelection = selectChecksByVerification(graph, runtimeChecks.smokeChecks, ["smoke", "journey"], {
    keepWebChecks: true
  });
  return {
    type: "runtime_smoke_plan",
    name: runtimeReference.smoke.name,
    projections: {
      api: apiProjection.id,
      ui: uiProjection.id
    },
    topology: {
      components: topology.components.map((component) => ({
        id: component.id,
        type: component.type,
        projection: component.projection.id,
        generator: component.generator
      }))
    },
    ...(verification ? { verification } : {}),
    ...(smokeSelection.selection ? { selection: smokeSelection.selection } : {}),
    env: {
      apiBase: "TOPOGRAM_API_BASE_URL",
      webBase: "TOPOGRAM_WEB_BASE_URL"
    },
    checks: smokeSelection.checks
  };
}

function renderRuntimeSmokeEnvExample(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const urls = runtimeUrls(runtimeReference, resolveRuntimeTopology(graph, options));
  return `TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_WEB_BASE_URL=${urls.web}
${runtimeReference.environment.envExample || ""}
`;
}

function renderRuntimeSmokeReadme(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const verification = buildVerificationSummary(graph, ["smoke", "journey"]);
  const verificationLines = verification
    ? `\n## Canonical Verification\n\n- Sources: ${verification.sources.map((entry) => `\`${entry.id}\``).join(", ")}\n- Scenarios: ${verification.scenarios.map((entry) => entry.label).join(", ")}\n`
    : "";
  return `# ${runtimeReference.smoke.bundleTitle}

This bundle gives you lightweight runtime verification for the generated stack.

Use it when you want a fast, minimal confidence check that the generated stack is basically up and responding.

## Usage

1. Set \`TOPOGRAM_API_BASE_URL\`
2. Set \`TOPOGRAM_WEB_BASE_URL\`
3. Run \`bash ./scripts/smoke.sh\`

The smoke test will:
- confirm the web UI responds on \`${runtimeReference.smoke.webPath}\`
- assume the generated demo seed data has been applied
- create a primary resource through the API
- fetch the created primary resource
- confirm the list endpoint responds

If you want staged readiness checks, richer API verification, and a machine-readable report, use the runtime-check bundle instead.
${verificationLines}`;
}

function renderRuntimeSmokeScript() {
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

node "$SCRIPT_DIR/smoke.mjs"
`;
}

function renderRuntimeSmokeModule(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const containerField = runtimeReference.smoke.createPayload.containerField;
  const payloadEntries = [
    ["title", runtimeReference.smoke.createPayload.title],
    [containerField, "__DEMO_CONTAINER_ID__"],
    ...Object.entries(runtimeReference.smoke.createPayload.extraFields || {})
  ];
  const payloadLines = payloadEntries.map(([key, value]) => {
    if (value === "__DEMO_CONTAINER_ID__") {
      return `    ${key}: demoContainerId`;
    }
    if (value === "__DEMO_USER_ID__") {
      return `    ${key}: demoUserId`;
    }
    return `    ${key}: ${JSON.stringify(value)}`;
  }).join(",\n");
  return `const apiBase = process.env.TOPOGRAM_API_BASE_URL || "";
const webBase = process.env.TOPOGRAM_WEB_BASE_URL || "";
const demoContainerId = process.env.${runtimeReference.smoke.defaultContainerEnvVar} || "${runtimeReference.demoEnv.containerId}";
const demoUserId = process.env.TOPOGRAM_DEMO_USER_ID || "${runtimeReference.demoEnv.userId}";
const authToken = process.env.TOPOGRAM_AUTH_TOKEN || "";

if (!apiBase || !webBase) {
  throw new Error("TOPOGRAM_API_BASE_URL and TOPOGRAM_WEB_BASE_URL are required");
}

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(\`\${label} expected \${expected}, got \${response.status}: \${body}\`);
  }
}

const webResponse = await fetch(new URL("${runtimeReference.smoke.webPath}", webBase));
await expectStatus(webResponse, 200, "web page");
const webText = await webResponse.text();
if (!webText.includes("${runtimeReference.smoke.expectText}")) {
  throw new Error("web page did not include expected page text");
}

const createResponse = await fetch(new URL("${runtimeReference.smoke.createPath}", apiBase), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
    ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {})
  },
  body: JSON.stringify({
${payloadLines}
  })
});
await expectStatus(createResponse, 201, "create resource");
const created = await createResponse.json();
if (!created.id) {
  throw new Error("create resource response did not include id");
}

const getResponse = await fetch(new URL(\`${runtimeReference.smoke.getPathPrefix}\${created.id}\`, apiBase), {
  headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : undefined
});
await expectStatus(getResponse, 200, "get resource");

const listResponse = await fetch(new URL("${runtimeReference.smoke.listPath}", apiBase), {
  headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : undefined
});
await expectStatus(listResponse, 200, "list resources");

console.log(JSON.stringify({
  ok: true,
  createdPrimaryId: created.id
}, null, 2));
`;
}

export function generateRuntimeSmokeBundle(graph, options = {}) {
  const plan = buildRuntimeSmokePlan(graph, options);
  return {
    ".env.example": renderRuntimeSmokeEnvExample(graph, options),
    "README.md": renderRuntimeSmokeReadme(graph, options),
    "runtime-smoke-plan.json": `${JSON.stringify(plan, null, 2)}\n`,
    "scripts/smoke.sh": renderRuntimeSmokeScript(),
    "scripts/smoke.mjs": renderRuntimeSmokeModule(graph, options)
  };
}

export function generateRuntimeSmokePlan(graph, options = {}) {
  return buildRuntimeSmokePlan(graph, options);
}
