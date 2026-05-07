import {
  generateRuntimeApiContracts,
  buildVerificationSummary,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology,
  selectChecksByVerification,
  runtimePorts,
  runtimeUrls
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { renderNodeScriptRunner } from "./bundle-shared.js";

function buildRuntimeCheckPlan(graph, options = {}) {
  const implementation = getExampleImplementation(graph, options);
  const runtimeReference = implementation.runtime.reference;
  const runtimeChecks = implementation.runtime.checks;
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const verification = buildVerificationSummary(graph, ["runtime", "contract", "journey"]);
  const apiSelection = selectChecksByVerification(graph, runtimeChecks.apiStage.checks, ["runtime", "contract", "journey"], {
    keepLookupChecks: true
  });
  const resolveLookupCheck = (check) => {
    if (!check.lookupKey) {
      return check;
    }
    const { lookupKey, ...rest } = check;
    const path = runtimeReference.runtimeCheck.lookupPaths[check.lookupKey];
    return path ? { ...rest, path } : rest;
  };
  return {
    type: "runtime_check_plan",
    name: runtimeReference.runtimeCheck.name,
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
    ...(verification ? { verification } : {}),
    ...(apiSelection.selection ? { selection: apiSelection.selection } : {}),
    env: {
      required: [
        ...runtimeReference.runtimeCheck.requiredEnv
      ],
      apiBase: "TOPOGRAM_API_BASE_URL",
      webBase: "TOPOGRAM_WEB_BASE_URL",
      demoContainerId: runtimeReference.runtimeCheck.demoContainerEnvVar,
      demoPrimaryId: runtimeReference.runtimeCheck.demoPrimaryEnvVar,
      demoUserId: "TOPOGRAM_DEMO_USER_ID"
    },
    report: {
      outputPath: "state/runtime-check-report.json"
    },
    stages: [
      {
        ...runtimeChecks.environmentStage,
        checks: runtimeChecks.environmentStage.checks.map(resolveLookupCheck)
      },
      {
        ...runtimeChecks.apiStage,
        checks: apiSelection.checks.map(resolveLookupCheck)
      }
    ]
  };
}

function renderRuntimeCheckEnvExample(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const demo = runtimeReference.demoEnv;
  const urls = runtimeUrls(runtimeReference, resolveRuntimeTopology(graph, options));
  return `TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_WEB_BASE_URL=${urls.web}
TOPOGRAM_DEMO_USER_ID=${demo.userId}
${runtimeReference.environment.envExample || ""}
`;
}

function renderRuntimeCheckReadme(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const verification = buildVerificationSummary(graph, ["runtime", "contract", "journey"]);
  const stageNames = (runtimeReference.runtimeCheck.stageNotes && runtimeReference.runtimeCheck.stageNotes.length > 0)
    ? runtimeReference.runtimeCheck.stageNotes
    : [
        {
          id: "environment",
          summary: "required env, web readiness, API health, API readiness, and seeded data checks"
        },
        {
          id: "api",
          summary: "core API happy paths, lookup endpoints, and important negative cases"
        }
      ];
  const notes = (runtimeReference.runtimeCheck.notes && runtimeReference.runtimeCheck.notes.length > 0)
    ? runtimeReference.runtimeCheck.notes
    : [
        "Mutating checks exercise the example's create/update/terminal flows.",
        "Lookup checks verify the generated lookup endpoints configured for the example.",
        "Later stages are skipped if environment readiness fails.",
        "The generated server exposes both `/health` and `/ready`.",
        "Use the smoke bundle for a faster minimal confidence check.",
        "Use this runtime-check bundle for richer staged verification and JSON reporting."
      ];
  return `# ${runtimeReference.runtimeCheck.bundleTitle}

This bundle gives you richer staged runtime verification for the generated stack.

Use it when you want more than a quick smoke test. It goes beyond the lightweight smoke bundle by checking environment readiness, API health, DB-backed seeded data, and deeper API behavior.

## Stages

${stageNames.map((stage) => `- \`${stage.id}\`: ${stage.summary}`).join("\n")}

## Usage

1. Copy \`.env.example\` to \`.env\` if needed
2. Run \`bash ./scripts/check.sh\`
3. Inspect \`state/runtime-check-report.json\`

## Notes

${notes.map((note) => `- ${note}`).join("\n")}
${verification ? `\n## Canonical Verification\n\n- Sources: ${verification.sources.map((entry) => `\`${entry.id}\``).join(", ")}\n- Scenarios: ${verification.scenarios.map((entry) => entry.label).join(", ")}` : ""}
`;
}

function renderRuntimeCheckScript() {
  return renderNodeScriptRunner("check.mjs", { searchParentEnv: true });
}

function renderRuntimeCheckModule(graph, options = {}) {
  const implementation = getExampleImplementation(graph, options);
  const runtimeReference = implementation.runtime.reference;
  const runtimeCheckRenderers = implementation.runtime.checkRenderers;
  const ports = runtimePorts(runtimeReference, resolveRuntimeTopology(graph, options));
  return `import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const plan = JSON.parse(await fs.readFile(path.join(rootDir, "runtime-check-plan.json"), "utf8"));
const apiContracts = JSON.parse(await fs.readFile(path.join(rootDir, "api-contracts.json"), "utf8"));
const reportPath = path.join(rootDir, plan.report.outputPath);
const execFileAsync = promisify(execFile);

const envVars = Object.fromEntries(Object.entries(plan.env).filter(([, value]) => typeof value === "string"));
${runtimeCheckRenderers.renderRuntimeCheckState()}

function envValue(name) {
  const direct = process.env[name];
  if (direct) {
    return direct;
  }

  const fallbackMap = {
    TOPOGRAM_API_BASE_URL: process.env.PUBLIC_TOPOGRAM_API_BASE_URL || "http://localhost:${ports.server}",
    TOPOGRAM_WEB_BASE_URL: process.env.PUBLIC_TOPOGRAM_WEB_BASE_URL || \`http://localhost:\${process.env.WEB_PORT || "${ports.web}"}\`,
    ${runtimeReference.runtimeCheck.demoContainerEnvVar}: process.env.PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID || "",
    ${runtimeReference.runtimeCheck.demoPrimaryEnvVar}: process.env.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID || "",
    TOPOGRAM_DEMO_USER_ID: process.env.PUBLIC_TOPOGRAM_DEMO_USER_ID || "",
    TOPOGRAM_AUTH_USER_ID: process.env.TOPOGRAM_DEMO_USER_ID || ""
  };

  return fallbackMap[name] || "";
}

function apiBase() {
  return envValue(plan.env.apiBase);
}

function webBase() {
  return envValue(plan.env.webBase);
}

function stackStartHint() {
  return "Start the generated stack with 'npm run dev' from the app bundle, or 'npm run app:dev' from the project root, then rerun this command.";
}

function describeFetchError(error) {
  if (error?.cause?.code) {
    return error.cause.code;
  }
  if (Array.isArray(error?.cause?.errors) && error.cause.errors.length > 0) {
    return [...new Set(error.cause.errors.map((entry) => entry.code).filter(Boolean))].join(", ");
  }
  return error instanceof Error ? error.message : String(error);
}

async function fetchWithStackHint(url, init, label) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(\`\${label} is not reachable at \${url.toString()}. \${stackStartHint()} Original error: \${describeFetchError(error)}\`);
  }
}

function resolveCheckPath(pathTemplate) {
  return String(pathTemplate || "")
    .replace(/\\$env:([A-Z0-9_]+)/g, (_, name) => encodeURIComponent(envValue(name)))
    .replace(/\\$state:primary_id/g, encodeURIComponent(String(state.latestPrimary?.id || state.createdPrimary?.id || "")));
}

function authToken() {
  return envValue("TOPOGRAM_AUTH_TOKEN");
}

function pathParamValue(token) {
  if (typeof token !== "string") {
    return token;
  }
  if (token.startsWith("$env:")) {
    return envValue(token.slice(5));
  }
  if (token === "$state:primary_id") {
    return state.latestPrimary?.id || state.createdPrimary?.id || "";
  }
  return token;
}

function contractFor(capabilityId) {
  const contract = apiContracts[capabilityId];
  if (!contract) {
    throw new Error(\`Missing API contract for \${capabilityId}\`);
  }
  return contract;
}

function buildUrl(base, endpointPath, pathParams = {}) {
  let resolvedPath = endpointPath;
  for (const [name, rawValue] of Object.entries(pathParams)) {
    const value = pathParamValue(rawValue);
    resolvedPath = resolvedPath.replace(\`:\${name}\`, encodeURIComponent(String(value)));
  }
  return new URL(resolvedPath, base);
}

function inferPathParams(contract, overrides = {}) {
  const params = {};
  for (const field of contract.requestContract?.transport?.path || []) {
    if (Object.prototype.hasOwnProperty.call(overrides, field.name)) {
      params[field.transport.wireName] = overrides[field.name];
      continue;
    }
    if (
      field.name.endsWith("_id") &&
      field.transport?.wireName === "id" &&
      field.name !== "job_id"
    ) {
      params[field.transport.wireName] = "$state:primary_id";
      continue;
    }
    if (field.name === "job_id") {
      throw new Error("Runtime checks do not support job_id paths in v1");
    }
  }
  return params;
}

${runtimeCheckRenderers.renderRuntimeCheckCreatePayload()}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertErrorResponse(responseBody, expectedCode, label) {
  assertCondition(responseBody && typeof responseBody === "object", \`\${label} did not return a JSON object body\`);
  assertCondition(responseBody.error && typeof responseBody.error === "object", \`\${label} did not include an error object\`);
  assertCondition(typeof responseBody.error.code === "string" && responseBody.error.code.length > 0, \`\${label} did not include an error code\`);
  assertCondition(typeof responseBody.error.message === "string" && responseBody.error.message.length > 0, \`\${label} did not include an error message\`);
  if (expectedCode) {
    assertCondition(responseBody.error.code === expectedCode, \`\${label} expected error code \${expectedCode}, got \${responseBody.error.code}\`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appleScriptString(value) {
  return JSON.stringify(String(value ?? ""));
}

async function runSafariBrowserCheck(definition) {
  if (process.platform !== "darwin") {
    throw new Error("web_browser_contract is only supported on macOS local stacks");
  }

  const targetUrl = new URL(resolveCheckPath(definition.path), webBase()).toString();
  const waitMs = Number(process.env.TOPOGRAM_BROWSER_WAIT_MS || "8000");
  const pollMs = Number(process.env.TOPOGRAM_BROWSER_POLL_MS || "250");
  const pollLimit = Math.max(1, Math.ceil(waitMs / pollMs));
  const pollDelaySeconds = pollMs / 1000;
  const browserApp = process.env.TOPOGRAM_BROWSER_APP || "Safari";
  const script = [
    \`set targetUrl to \${appleScriptString(targetUrl)}\`,
    \`set expectedText to \${appleScriptString(definition.expectText || "")}\`,
    \`set forbiddenText to \${appleScriptString(definition.expectNotText || "")}\`,
    \`set pollLimit to \${appleScriptString(pollLimit)} as integer\`,
    \`set pollDelay to \${appleScriptString(pollDelaySeconds)} as real\`,
    \`tell application \${appleScriptString(browserApp)}\`,
    "activate",
    "set runtimeDoc to make new document with properties {URL:targetUrl}",
    "repeat with attempt from 1 to pollLimit",
    "delay pollDelay",
    "try",
    "set bodyText to do JavaScript \\"document.body ? document.body.innerText : ''\\" in runtimeDoc",
    "if (expectedText is \\"\\" or bodyText contains expectedText) and (forbiddenText is \\"\\" or bodyText does not contain forbiddenText) then exit repeat",
    "end try",
    "end repeat",
    "set finalText to do JavaScript \\"document.body ? document.body.innerText : ''\\" in runtimeDoc",
    "close runtimeDoc",
    "return finalText",
    "end tell"
  ];
  const args = script.flatMap((line) => ["-e", line]);
  const { stdout, stderr } = await execFileAsync("osascript", args);
  if (stderr && stderr.trim()) {
    throw new Error(\`browser check failed: \${stderr.trim()}\`);
  }
  return stdout.trim();
}

${runtimeCheckRenderers.renderRuntimeCheckHelpers()}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }
  return text;
}

async function requestContract(capabilityId, { payload = null, pathParams = null, headers = {} } = {}) {
  const contract = contractFor(capabilityId);
  const resolvedPathParams = pathParams || inferPathParams(contract);
  const url = buildUrl(apiBase(), contract.endpoint.path, resolvedPathParams);
  const requestHeaders = new Headers(headers);
  if ((contract.endpoint.authz || []).length > 0 && authToken() && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", \`Bearer \${authToken()}\`);
  }
  let body;
  if (payload && (contract.requestContract?.transport?.body || []).length > 0) {
    requestHeaders.set("content-type", "application/json");
    body = JSON.stringify(payload);
  }
  const response = await fetchWithStackHint(url, {
    method: contract.endpoint.method,
    headers: requestHeaders,
    body
  }, "api service");
  const responseBody = await parseResponseBody(response);
  return { contract, response, responseBody, url: url.toString() };
}

function preconditionStatusFor(contract) {
  return contract.endpoint.preconditions?.[0]?.error || 412;
}

function visibleTextFromHtml(html) {
  return String(html || "")
    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\s+/g, " ")
    .trim();
}

function checkResultTemplate(definition) {
  return {
    id: definition.id,
    kind: definition.kind,
    mandatory: definition.mandatory !== false,
    mutating: Boolean(definition.mutating),
    ok: null,
    skipped: false,
    durationMs: 0,
    error: null,
    resources: {}
  };
}

async function runCheck(definition) {
  const startedAt = Date.now();
  const result = checkResultTemplate(definition);
  try {
    if (definition.id === "required_env") {
      const missing = plan.env.required.filter((name) => !envValue(name));
      assertCondition(missing.length === 0, \`Missing required environment variables: \${missing.join(", ")}\`);
    } else if (definition.kind === "web_contract") {
      const response = await fetchWithStackHint(new URL(resolveCheckPath(definition.path), webBase()), undefined, "web app");
      const body = await response.text();
      const bodyText = visibleTextFromHtml(body);
      assertCondition(response.status === definition.expectStatus, \`web readiness expected \${definition.expectStatus}, got \${response.status}\`);
      assertCondition(bodyText.includes(definition.expectText), \`web readiness did not include expected text: \${definition.expectText}\`);
      if (definition.expectNotText) {
        assertCondition(!bodyText.includes(definition.expectNotText), \`web readiness unexpectedly included text: \${definition.expectNotText}\`);
      }
    } else if (definition.kind === "web_browser_contract") {
      const bodyText = await runSafariBrowserCheck(definition);
      if (definition.expectText) {
        assertCondition(bodyText.includes(definition.expectText), \`browser check did not include expected text: \${definition.expectText}\`);
      }
      if (definition.expectNotText) {
        assertCondition(!bodyText.includes(definition.expectNotText), \`browser check unexpectedly included text: \${definition.expectNotText}\`);
      }
    } else if (definition.kind === "api_health") {
      const response = await fetchWithStackHint(new URL(definition.path, apiBase()), undefined, "api service");
      const responseBody = await parseResponseBody(response);
      assertCondition(response.status === definition.expectStatus, \`api health expected \${definition.expectStatus}, got \${response.status}\`);
      assertCondition(responseBody?.ok === definition.expectOk, "api health did not report ok");
    } else if (definition.kind === "api_ready") {
      const response = await fetchWithStackHint(new URL(definition.path, apiBase()), undefined, "api service");
      const responseBody = await parseResponseBody(response);
      assertCondition(response.status === definition.expectStatus, \`api readiness expected \${definition.expectStatus}, got \${response.status}\`);
      assertCondition(responseBody?.ready === definition.expectReady, "api readiness did not report ready");
${runtimeCheckRenderers.renderRuntimeCheckCases()}
    } else {
      throw new Error(\`Unsupported runtime check id: \${definition.id}\`);
    }
    result.ok = true;
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    result.durationMs = Date.now() - startedAt;
  }
  return result;
}

function stageSummary(stageDefinition, checks) {
  const failedMandatory = checks.some((check) => check.ok === false && check.mandatory);
  const skipped = checks.every((check) => check.skipped);
  return {
    id: stageDefinition.id,
    name: stageDefinition.name,
    ok: skipped ? null : !failedMandatory,
    skipped,
    checks
  };
}

function skippedChecksForStage(stageDefinition, reason) {
  return stageDefinition.checks.map((definition) => ({
    ...checkResultTemplate(definition),
    skipped: true,
    error: reason
  }));
}

function logCheck(stageId, result) {
  const icon = result.skipped ? "-" : result.ok ? "[ok]" : "[fail]";
  const suffix = result.error ? \` - \${result.error}\` : "";
  console.log(\`\${icon} \${stageId}:\${result.id} (\${result.durationMs}ms)\${suffix}\`);
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, \`\${JSON.stringify(report, null, 2)}\\n\`, "utf8");
}

const report = {
  ok: true,
  name: plan.name,
  reportPath: plan.report.outputPath,
  stages: [],
  generatedAt: new Date().toISOString()
};

let stopFurtherStages = false;

for (const stageDefinition of plan.stages) {
  if (stopFurtherStages) {
    const skippedChecks = skippedChecksForStage(stageDefinition, "Skipped because a prior fail-fast stage failed");
    for (const check of skippedChecks) {
      logCheck(stageDefinition.id, check);
    }
    report.stages.push(stageSummary(stageDefinition, skippedChecks));
    continue;
  }

  const checks = [];
  for (const checkDefinition of stageDefinition.checks) {
    const result = await runCheck(checkDefinition);
    checks.push(result);
    logCheck(stageDefinition.id, result);
    if (stageDefinition.failFast && result.ok === false && result.mandatory) {
      stopFurtherStages = true;
      break;
    }
  }

  if (stopFurtherStages && checks.length < stageDefinition.checks.length) {
    const remaining = stageDefinition.checks.slice(checks.length).map((definition) => ({
      ...checkResultTemplate(definition),
      skipped: true,
      error: "Skipped because this stage failed in fail-fast mode"
    }));
    for (const check of remaining) {
      logCheck(stageDefinition.id, check);
    }
    checks.push(...remaining);
  }

  report.stages.push(stageSummary(stageDefinition, checks));
}

report.ok = report.stages.every((stage) => stage.ok !== false);
await writeReport(report);
console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
`;
}

export function generateRuntimeCheckBundle(graph, options = {}) {
  const plan = buildRuntimeCheckPlan(graph, options);
  return {
    ".env.example": renderRuntimeCheckEnvExample(graph, options),
    "README.md": renderRuntimeCheckReadme(graph, options),
    "runtime-check-plan.json": `${JSON.stringify(plan, null, 2)}\n`,
    "api-contracts.json": `${JSON.stringify(generateRuntimeApiContracts(graph), null, 2)}\n`,
    "scripts/check.sh": renderRuntimeCheckScript(),
    "scripts/check.mjs": renderRuntimeCheckModule(graph, options)
  };
}

export function generateRuntimeCheckPlan(graph, options = {}) {
  return buildRuntimeCheckPlan(graph, options);
}
