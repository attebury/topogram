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
import { buildVerificationSummary, getDefaultEnvironmentProjections, runtimePorts, runtimeUrls } from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { mergeNamedBundles, renderLoadEnvScript, renderNestedBundleShellScript } from "./bundle-shared.js";

function buildAppBundlePlan(graph, options = {}) {
  const runtimeReference = structuredClone(getExampleImplementation(graph).runtime.reference);
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
      api: apiProjection.id,
      ui: uiProjection.id,
      db: dbProjection.id
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
      app: "app",
      deploy: "deploy",
      smoke: "smoke",
      runtimeCheck: "runtime-check",
      compile: "compile"
    }
  };
}

function renderAppBundleEnvExample(plan) {
  const demo = plan.runtimeReference.demoEnv;
  const databaseName = plan.runtimeReference.environment.databaseName || "topogram_app";
  const ports = runtimePorts(plan.runtimeReference);
  const urls = runtimeUrls(plan.runtimeReference);
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
  const urls = runtimeUrls(plan.runtimeReference);
  return `# ${plan.name}

This is the polished generated app bundle for Topogram v0.1.

It includes:
- \`app/\`: the runnable local app stack
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
5. Run richer staged runtime checks:
   - \`bash ${plan.commands.runtimeCheck.replace("./", "")}\`
6. Run the lightweight smoke check:
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
- Use \`smoke/\` when you want a quick "is the stack basically working?" check
- Use \`runtime-check/\` when you want staged readiness plus deeper API flow coverage
`;
}

function renderAppBundlePackageJson() {
  return `${JSON.stringify({
    name: "topogram-app-bundle",
    private: true,
    scripts: {
      bootstrap: "bash ./scripts/bootstrap.sh",
      dev: "bash ./scripts/dev.sh",
      compile: "bash ./scripts/compile-check.sh",
      "runtime-check": "bash ./scripts/runtime-check.sh",
      smoke: "bash ./scripts/smoke.sh",
      "deploy:check": "bash ./scripts/deploy-check.sh"
    }
  }, null, 2)}\n`;
}

function renderAppBundleLoadEnvScript() {
  return renderLoadEnvScript();
}

function renderAppBundleBootstrapScript() {
  return renderNestedBundleShellScript("app", "scripts/bootstrap-db.sh");
}

function renderAppBundleDevScript() {
  return renderNestedBundleShellScript("app", "scripts/stack-dev.sh");
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

export function generateAppBundle(graph, options = {}) {
  const plan = buildAppBundlePlan(graph, options);
  plan.projections.dbPlatform = getDefaultEnvironmentProjections(graph, options).dbProjection.platform;
  const envBundle = generateEnvironmentBundle(graph, { profileId: plan.profiles.environment });
  const deployBundle = generateDeploymentBundle(graph, { profileId: plan.profiles.deployment });
  const smokeBundle = generateRuntimeSmokeBundle(graph, {});
  const runtimeCheckBundle = generateRuntimeCheckBundle(graph, {});
  const compileBundle = generateCompileCheckBundle(graph, {});

  const files = {
    ".env.example": renderAppBundleEnvExample(plan),
    ".gitignore": "node_modules/\n.env\n",
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
    app: envBundle,
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
