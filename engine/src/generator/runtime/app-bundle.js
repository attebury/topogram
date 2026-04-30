import {
  generateCompileCheckBundle
} from "./compile-check.js";
import {
  generateDeploymentBundle
} from "./deployment.js";
import {
  generateEnvironmentBundle
} from "./environment.js";
import {
  generateRuntimeCheckBundle
} from "./runtime-check.js";
import {
  generateRuntimeSmokeBundle
} from "./smoke.js";
import {
  buildVerificationSummary,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology,
  runtimePorts,
  runtimeUrls
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { mergeNamedBundles, renderLoadEnvScript, renderNestedBundleShellScript } from "./bundle-shared.js";

function runtimeReferenceFor(graph, options = {}) {
  try {
    return structuredClone(getExampleImplementation(graph, options).runtime.reference);
  } catch {
    return {
      appBundle: {
        name: "Topogram App Bundle",
        demoContainerName: "Hello workflow",
        demoPrimaryTitle: "Hello page"
      },
      environment: { databaseName: "topogram_app", envExample: "" },
      ports: { server: 3000, web: 5173 },
      demoEnv: { userId: "11111111-1111-4111-8111-111111111111" },
      smoke: { webPath: "/", expectText: "Topogram" },
      runtimeCheck: {}
    };
  }
}

function buildAppBundlePlan(graph, options = {}) {
  const runtimeReference = runtimeReferenceFor(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const environmentProfile = options.profileId || "local_process";
  const deployProfile = options.deployProfileId || "fly_io";
  const smokeVerification = buildVerificationSummary(graph, ["smoke", "journey"]);
  const runtimeVerification = buildVerificationSummary(graph, ["runtime", "contract", "journey"]);
  if (smokeVerification) {
    runtimeReference.smoke.verification = smokeVerification;
  }
  if (runtimeVerification) {
    runtimeReference.runtimeCheck.verification = runtimeVerification;
  }
  return {
    type: "app_bundle_plan",
    name: runtimeReference.appBundle.name,
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
        generator: component.generator,
        port: component.port ?? null,
        api: component.api || null,
        database: component.database || null
      }))
    },
    runtimeReference,
    profiles: {
      environment: environmentProfile,
      deployment: deployProfile
    },
    commands: {
      bootstrap: "./scripts/bootstrap.sh",
      dev: "./scripts/dev.sh",
      compile: "./scripts/compile-check.sh",
      smoke: "./scripts/smoke.sh",
      runtimeCheck: "./scripts/runtime-check.sh",
      deployCheck: "./scripts/deploy-check.sh"
    },
    layout: {
      apps: "apps",
      deploy: "deploy",
      smoke: "smoke",
      runtimeCheck: "runtime-check",
      compile: "compile",
      services: "apps/services",
      web: "apps/web",
      db: "apps/db",
      native: "apps/native"
    }
  };
}

function renderAppBundleEnvExample(plan) {
  const demo = plan.runtimeReference.demoEnv;
  const databaseName = plan.runtimeReference.environment.databaseName || "topogram_app";
  const topology = {
    primaryApi: { port: plan.topology.components.find((component) => component.type === "api")?.port },
    primaryWeb: { port: plan.topology.components.find((component) => component.type === "web")?.port }
  };
  const ports = runtimePorts(plan.runtimeReference, topology);
  const urls = runtimeUrls(plan.runtimeReference, topology);
  if (!plan.projections.dbPlatform) {
    return `# App bundle defaults
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.profiles.environment}
TOPOGRAM_DEPLOY_PROFILE=${plan.profiles.deployment}

# Local runtime defaults
${plan.projections.api ? `SERVER_PORT=${ports.server}\n` : ""}${plan.projections.ui ? `WEB_PORT=${ports.web}\n` : ""}${plan.projections.api && plan.projections.ui ? `PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}\n` : ""}PUBLIC_TOPOGRAM_DEMO_USER_ID=${demo.userId}
TOPOGRAM_DEMO_USER_ID=${demo.userId}
${plan.runtimeReference.environment.envExample || ""}

# Smoke-test defaults
${plan.projections.api ? `TOPOGRAM_API_BASE_URL=${urls.api}\n` : ""}${plan.projections.ui ? `TOPOGRAM_WEB_BASE_URL=${urls.web}\n` : ""}`;
  }
  if (plan.projections.dbPlatform === "db_sqlite") {
    return `# App bundle defaults
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.profiles.environment}
TOPOGRAM_DEPLOY_PROFILE=${plan.profiles.deployment}

# Local runtime defaults
SERVER_PORT=${ports.server}
WEB_PORT=${ports.web}
DATABASE_URL=file:./var/${databaseName}.sqlite
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${demo.userId}
TOPOGRAM_DEMO_USER_ID=${demo.userId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true

# Smoke-test defaults
TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_WEB_BASE_URL=${urls.web}
`;
  }
  return `# App bundle defaults
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.profiles.environment}
TOPOGRAM_DEPLOY_PROFILE=${plan.profiles.deployment}

# Local runtime defaults
DB_PORT=5432
SERVER_PORT=${ports.server}
WEB_PORT=${ports.web}
POSTGRES_DB=${databaseName}
POSTGRES_USER=\${USER:-postgres}
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://\${POSTGRES_USER}@localhost:5432/${databaseName}
DATABASE_ADMIN_URL=postgresql://\${POSTGRES_USER}@localhost:5432/postgres
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${demo.userId}
TOPOGRAM_DEMO_USER_ID=${demo.userId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true

# Smoke-test defaults
TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_WEB_BASE_URL=${urls.web}
`;
}

function renderAppBundleReadme(plan) {
  const urls = runtimeUrls(plan.runtimeReference, {
    primaryApi: { port: plan.topology.components.find((component) => component.type === "api")?.port },
    primaryWeb: { port: plan.topology.components.find((component) => component.type === "web")?.port }
  });
  return `# ${plan.name}

This is the polished generated app bundle for Topogram v0.1.

It includes:
- \`apps/services/<api-id>/\`: generated API service scaffolds
- \`apps/web/<web-id>/\`: generated web scaffolds
- \`apps/db/<db-id>/\`: generated DB lifecycle bundles
- \`apps/native/<native-id>/\`: generated native app scaffolds
- \`deploy/\`: deployment packaging
- \`compile/\`: generated compile verification
- \`smoke/\`: minimal runtime confidence check
- \`runtime-check/\`: richer staged runtime verification with JSON reporting

## Start Here

1. Copy \`.env.example\` to \`.env\` if you want to customize defaults
2. Bootstrap the app:
   - \`bash ${plan.commands.bootstrap.replace("./", "")}\`
   - this provisions or migrates the database and seeds demo data by default
3. Run the app:
   - \`bash ${plan.commands.dev.replace("./", "")}\`
4. Compile-check it:
   - \`bash ${plan.commands.compile.replace("./", "")}\`
5. With the app still running, run richer staged runtime checks in another terminal:
   - \`bash ${plan.commands.runtimeCheck.replace("./", "")}\`
6. With the app still running, run the lightweight smoke check:
   - \`bash ${plan.commands.smoke.replace("./", "")}\`

## Golden Path

For the default generated bundle:

1. Use the \`${plan.profiles.environment}\` environment profile
2. Run \`bash ${plan.commands.bootstrap.replace("./", "")}\`
3. Run \`bash ${plan.commands.dev.replace("./", "")}\`
4. Open the web app at \`${urls.web}${plan.runtimeReference.smoke.webPath}\`
5. Confirm the seeded "${plan.runtimeReference.appBundle.demoContainerName}" and "${plan.runtimeReference.appBundle.demoPrimaryTitle}" flow through the stack
6. Run \`bash ${plan.commands.compile.replace("./", "")}\`
7. Run \`bash ${plan.commands.runtimeCheck.replace("./", "")}\`
8. Run \`bash ${plan.commands.smoke.replace("./", "")}\`

## Deployment

- Validate deploy configuration:
  - \`bash ${plan.commands.deployCheck.replace("./", "")}\`
- Then use the generated deployment bundle under \`deploy/\`

## Notes

- The default generated app profile is \`${plan.profiles.environment}\`
- The default generated deployment profile is \`${plan.profiles.deployment}\`
- Demo data is seeded during bootstrap unless \`TOPOGRAM_SEED_DEMO=false\`
- If \`.env\` is missing, generated scripts fall back to \`.env.example\`
- You can regenerate other environment or deployment profiles from the Topogram source project
- The generated server exposes \`GET /health\` for liveness and \`GET /ready\` for DB-backed readiness
- \`compile/\` is self-contained and does not require the app to be running
- \`smoke/\` and \`runtime-check/\` are probes against a running local stack
`;
}

function renderAppBundlePackageJson() {
  return `${JSON.stringify({
    name: "topogram-app-bundle",
    private: true,
    scripts: {
      check: "npm run compile",
      bootstrap: "bash ./scripts/bootstrap.sh",
      dev: "bash ./scripts/dev.sh",
      compile: "bash ./scripts/compile-check.sh",
      "runtime-check": "bash ./scripts/runtime-check.sh",
      smoke: "bash ./scripts/smoke.sh",
      probe: "npm run smoke && npm run runtime-check",
      "deploy:check": "bash ./scripts/deploy-check.sh"
    }
  }, null, 2)}\n`;
}

function renderAppBundleLoadEnvScript() {
  return renderLoadEnvScript();
}

function renderAppBundleBootstrapScript() {
  return renderNestedBundleShellScript("apps", "scripts/bootstrap-db.sh");
}

function renderAppBundleDevScript() {
  return renderNestedBundleShellScript("apps", "scripts/stack-dev.sh");
}

function renderAppBundleSmokeScript() {
  return renderNestedBundleShellScript("smoke", "scripts/smoke.sh");
}

function renderAppBundleRuntimeCheckScript() {
  return renderNestedBundleShellScript("runtime-check", "scripts/check.sh");
}

function renderAppBundleCompileScript() {
  return renderNestedBundleShellScript("compile", "scripts/check.sh");
}

function renderAppBundleDeployCheckScript() {
  return renderNestedBundleShellScript("deploy", "scripts/deploy-check.sh");
}

function noopBundle(name, message) {
  return {
    "README.md": `# ${name}\n\n${message}\n`,
    "scripts/check.sh": `#!/usr/bin/env bash\nset -euo pipefail\necho ${JSON.stringify(message)}\n`,
    "scripts/smoke.sh": `#!/usr/bin/env bash\nset -euo pipefail\necho ${JSON.stringify(message)}\n`,
    "scripts/deploy-check.sh": `#!/usr/bin/env bash\nset -euo pipefail\necho ${JSON.stringify(message)}\n`
  };
}

export function generateAppBundle(graph, options = {}) {
  const plan = buildAppBundlePlan(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const projections = getDefaultEnvironmentProjections(graph, options);
  plan.projections.dbPlatform = projections.dbProjection?.platform || null;
  const fullStack = topology.apiComponents.length > 0 && topology.webComponents.length > 0 && topology.dbComponents.length > 0;
  const envBundle = generateEnvironmentBundle(graph, { ...options, profileId: plan.profiles.environment });
  const deployBundle = fullStack
    ? generateDeploymentBundle(graph, { ...options, profileId: plan.profiles.deployment })
    : noopBundle("Deployment Check", "No deployment bundle is generated for this partial topology.");
  const smokeBundle = fullStack
    ? generateRuntimeSmokeBundle(graph, options)
    : noopBundle("Runtime Smoke", "No runtime smoke bundle is generated for this partial topology.");
  const runtimeCheckBundle = fullStack
    ? generateRuntimeCheckBundle(graph, options)
    : noopBundle("Runtime Check", "No runtime check bundle is generated for this partial topology.");
  const compileBundle = generateCompileCheckBundle(graph, options);

  const files = {
    ".env.example": renderAppBundleEnvExample(plan),
    ".gitignore": "node_modules/\n.env\n**/node_modules/\n**/package-lock.json\n",
    "README.md": renderAppBundleReadme(plan),
    "package.json": renderAppBundlePackageJson(),
    "app-bundle-plan.json": `${JSON.stringify(plan, null, 2)}\n`,
    "scripts/load-env.sh": renderAppBundleLoadEnvScript(),
    "scripts/bootstrap.sh": renderAppBundleBootstrapScript(),
    "scripts/dev.sh": renderAppBundleDevScript(),
    "scripts/compile-check.sh": renderAppBundleCompileScript(),
    "scripts/runtime-check.sh": renderAppBundleRuntimeCheckScript(),
    "scripts/smoke.sh": renderAppBundleSmokeScript(),
    "scripts/deploy-check.sh": renderAppBundleDeployCheckScript()
  };

  mergeNamedBundles(files, {
    apps: envBundle,
    deploy: deployBundle,
    smoke: smokeBundle,
    "runtime-check": runtimeCheckBundle,
    compile: compileBundle
  });

  return files;
}

export function generateAppBundlePlan(graph, options = {}) {
  return buildAppBundlePlan(graph, options);
}
