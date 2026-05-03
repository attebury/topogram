import {
  generateDbBundle,
  generateServerBundle,
  generateWebBundle,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology
} from "./shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import { mergeNamedBundles, renderRootEnvFileShellScript, renderRootShellScript } from "./bundle-shared.js";
import { generatorProfile as manifestGeneratorProfile } from "../registry.js";

function projectionHintProfile(projection, fallback) {
  for (const entry of projection.generatorDefaults || []) {
    if (entry.key === "profile" && entry.value != null) {
      return entry.value;
    }
  }
  return fallback;
}

function slugifyAppName(name) {
  return String(name || "topogram-app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "topogram-app";
}

function buildDeploymentPlan(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph, options).runtime.reference;
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const profile = options.profileId || "fly_io";
  const supportedProfiles = ["fly_io", "railway"];
  const webProfile = manifestGeneratorProfile(topology.primaryWeb?.generator?.id, null) || projectionHintProfile(uiProjection, "sveltekit");
  const databaseTarget = dbProjection.platform === "db_sqlite"
    ? "sqlite_file"
    : profile === "fly_io"
      ? "managed_postgres"
      : "railway_postgres";
  if (!supportedProfiles.includes(profile)) {
    throw new Error(`Unsupported deployment profile '${profile}'`);
  }

  return {
    type: "deployment_plan",
    deployment: {
      name: runtimeReference.appBundle.name.replace("App Bundle", "Deployment Stack"),
      profile
    },
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
        generator: component.generator,
        port: component.port ?? null,
        api: component.api || null,
        database: component.database || null
      }))
    },
    directories: {
      server: topology.serviceDir(topology.primaryApi),
      web: topology.webDir(topology.primaryWeb),
      db: topology.dbDir(topology.primaryDb)
    },
    runtime: {
      server: manifestGeneratorProfile(topology.primaryApi?.generator?.id, "hono"),
      web: webProfile,
      orm: "prisma",
      serverPort: topology.primaryApi?.port || 3000
    },
    targets: {
      server: profile === "fly_io" ? "fly.io" : "railway",
      web: "vercel",
      database: databaseTarget
    },
    requiredEnv: ["DATABASE_URL", "PUBLIC_TOPOGRAM_API_BASE_URL"],
    recommendedCommands: {
      deployServer: profile === "fly_io" ? "fly deploy" : "railway up",
      deployWeb: "vercel deploy",
      migrate: "npm run db:migrate"
    }
  };
}

function renderDeploymentEnvExample(plan) {
  return `# Deployment profile
TOPOGRAM_DEPLOY_PROFILE=${plan.deployment.profile}

# Shared runtime variables
DATABASE_URL=
PUBLIC_TOPOGRAM_API_BASE_URL=

# Optional server runtime values
PORT=${plan.runtime.serverPort}
NODE_ENV=production
`;
}

function renderDeploymentReadme(plan) {
  const platformNotes = plan.deployment.profile === "fly_io"
    ? `## Fly.io Server Deploy

- Review \`fly.toml\`
- Set secrets with \`fly secrets set DATABASE_URL=...\`
- Deploy with \`${plan.recommendedCommands.deployServer}\`
`
    : `## Railway Server Deploy

- Review \`railway.json\`
- Set environment variables in Railway
- Deploy with \`${plan.recommendedCommands.deployServer}\`
`;

  return `# ${plan.deployment.name}

This bundle packages deployment helpers for the generated runtime.

- \`${plan.directories.server}/\`: generated Hono + Prisma server scaffold
- \`${plan.directories.web}/\`: generated ${plan.runtime.web === "react" ? "Vite + React Router" : "SvelteKit"} web scaffold
- platform deployment files for \`${plan.deployment.profile}\`
- a Vercel config for the web app

${platformNotes}
## Web Deploy

- Review \`${plan.directories.web}/vercel.json\`
- Set \`PUBLIC_TOPOGRAM_API_BASE_URL\`
- Deploy with \`${plan.recommendedCommands.deployWeb}\`

## Database Migrations

- Run \`${plan.recommendedCommands.migrate}\` against the target database before or during deploy
- The generated server bundle includes Prisma schema and DB lifecycle scripts for greenfield or brownfield environments
`;
}

function renderDeploymentPackageJson(plan) {
  return `${JSON.stringify({
    name: "topogram-deployment-bundle",
    private: true,
    scripts: {
      "deploy:check": "bash ./scripts/deploy-check.sh",
      "deploy:server": plan.recommendedCommands.deployServer,
      "deploy:web": plan.recommendedCommands.deployWeb,
      "db:migrate": "bash ./scripts/deploy-migrate.sh"
    }
  }, null, 2)}\n`;
}

function renderDeploymentCheckScript(plan) {
  return renderRootEnvFileShellScript([
    "for name in DATABASE_URL PUBLIC_TOPOGRAM_API_BASE_URL; do",
    '  if [[ -z "${!name:-}" ]]; then',
    '    echo "Missing required deployment variable: $name" >&2',
    "    exit 1",
    "  fi",
    "done",
    "",
    `echo "Deployment configuration looks ready for ${plan.deployment.profile}."`
  ], {
    blankLineAfterRoot: false,
    includeScriptDir: false,
    rootDirExpression: 'ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"'
  });
}

function renderDeploymentMigrateScript(plan) {
  return renderRootShellScript([
    `cd "$ROOT_DIR/${plan.directories.server}"`,
    "npm install",
    "npm exec -- prisma generate --schema prisma/schema.prisma",
    "npm exec -- prisma db push --schema prisma/schema.prisma --skip-generate"
  ]);
}

function renderServerDockerfile(plan) {
  return `FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm exec -- prisma generate --schema prisma/schema.prisma

ENV PORT=${plan.runtime.serverPort}
EXPOSE ${plan.runtime.serverPort}

CMD ["npm", "run", "dev"]
`;
}

function renderFlyToml(plan) {
  return `app = "${slugifyAppName(plan.deployment.name)}"
primary_region = "ord"

[build]
  dockerfile = "${plan.directories.server}/Dockerfile"

[env]
  PORT = "${plan.runtime.serverPort}"

[http_service]
  internal_port = ${plan.runtime.serverPort}
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
`;
}

function renderRailwayJson(plan) {
  return `${JSON.stringify({
    "$schema": "https://railway.app/railway.schema.json",
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: `${plan.directories.server}/Dockerfile`
    },
    deploy: {
      startCommand: "npm run dev",
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10
    }
  }, null, 2)}\n`;
}

function renderVercelJson(plan) {
  return `${JSON.stringify({
    framework: plan.runtime.web === "react" ? "vite" : "sveltekit"
  }, null, 2)}\n`;
}

export function generateDeploymentBundle(graph, options = {}) {
  const plan = buildDeploymentPlan(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const files = {
    ".env.example": renderDeploymentEnvExample(plan),
    "README.md": renderDeploymentReadme(plan),
    "package.json": renderDeploymentPackageJson(plan),
    "scripts/deploy-check.sh": renderDeploymentCheckScript(plan),
    "scripts/deploy-migrate.sh": renderDeploymentMigrateScript(plan),
    [`${plan.directories.server}/Dockerfile`]: renderServerDockerfile(plan),
    [`${plan.directories.web}/vercel.json`]: renderVercelJson(plan)
  };

  if (plan.deployment.profile === "fly_io") {
    files["fly.toml"] = renderFlyToml(plan);
  }
  if (plan.deployment.profile === "railway") {
    files["railway.json"] = renderRailwayJson(plan);
  }

  for (const component of topology.apiComponents) {
    const serverBundle = generateServerBundle(graph, component.projection.id, { ...options, component });
    mergeNamedBundles(files, {
      [topology.serviceDir(component)]: serverBundle
    });
  }
  for (const component of topology.webComponents) {
    const webBundle = generateWebBundle(graph, component.projection.id, { ...options, component });
    mergeNamedBundles(files, {
      [topology.webDir(component)]: webBundle
    });
  }
  for (const component of topology.dbComponents) {
    const dbBundle = generateDbBundle(graph, component.projection.id, { ...options, component });
    mergeNamedBundles(files, {
      [topology.dbDir(component)]: dbBundle
    });
  }

  return files;
}

export function generateDeploymentPlan(graph, options = {}) {
  return buildDeploymentPlan(graph, options);
}
