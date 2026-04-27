import { generateDbLifecyclePlan } from "../db/lifecycle-shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import {
  generateDbBundle,
  generateServerBundle,
  generateWebBundle,
  getDefaultEnvironmentProjections,
  runtimePorts,
  runtimeUrls
} from "./shared.js";
import { mergeNamedBundles, renderEnvAwareShellScript, renderLoadEnvScript, renderRootShellScript } from "./bundle-shared.js";

function generatorProfile(projection, fallback) {
  for (const entry of projection.generatorDefaults || []) {
    if (entry.key === "profile" && entry.value != null) {
      return entry.value;
    }
  }
  return fallback;
}

function buildEnvironmentPlan(graph, options = {}) {
  const runtimeReference = getExampleImplementation(graph).runtime.reference;
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const dbLifecycle = generateDbLifecyclePlan(graph, { projectionId: dbProjection.id });
  const profile = options.profileId || (dbProjection.platform === "db_sqlite" ? "local_process" : "local_docker");
  const usesDocker = profile === "local_docker";
  const webProfile = generatorProfile(uiProjection, "sveltekit");
  const isSqlite = dbProjection.platform === "db_sqlite";
  const ports = runtimePorts(runtimeReference);

  return {
    type: "environment_plan",
    environment: {
      id: `${apiProjection.id}__${uiProjection.id}__${dbProjection.id}`,
      name: runtimeReference.environment.name,
      mode: "local_dev",
      profile
    },
    projections: {
      api: {
        id: apiProjection.id,
        platform: apiProjection.platform
      },
      ui: {
        id: uiProjection.id,
        platform: uiProjection.platform
      },
      db: {
        id: dbProjection.id,
        platform: dbProjection.platform,
        profile: dbProjection.generatorDefaults?.profile || dbProjection.profile || null
      }
    },
    generators: {
      server: "hono-server",
      web: "sveltekit-app",
      dbLifecycle: "db-lifecycle-bundle"
    },
    runtimeProfiles: {
      server: "hono",
      web: webProfile,
      orm: dbLifecycle.runtimeProfile,
      database: dbLifecycle.dbProfile
    },
    orchestration: {
      usesDocker,
      database: isSqlite
        ? "local_process_sqlite"
        : usesDocker
          ? "docker_postgres"
          : "local_process_postgres"
    },
    directories: {
      server: "server",
      web: "web",
      db: "db",
      scripts: "scripts"
    },
    ports: {
      database: isSqlite ? null : 5432,
      server: ports.server,
      web: ports.web
    },
    files: {
      rootEnv: ".env.example",
      dockerCompose: usesDocker ? "docker-compose.yml" : null,
      readme: "README.md",
      packageJson: "package.json"
    },
    commands: {
      bootstrapDb: "./scripts/bootstrap-db.sh",
      dev: "./scripts/stack-dev.sh",
      dockerDb: usesDocker ? "./scripts/docker-db.sh" : null,
      dockerStack: usesDocker ? "./scripts/docker-stack.sh" : null
    },
    runtimeReference
  };
}

function renderEnvironmentEnvExample(plan) {
  const demo = plan.runtimeReference.demoEnv;
  const databaseName = plan.runtimeReference.environment.databaseName || "topogram_app";
  const urls = runtimeUrls(plan.runtimeReference);
  if (plan.projections.db.platform === "db_sqlite") {
    return `# Environment profile
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.environment.profile}

# Local stack ports
SERVER_PORT=${plan.ports.server}
WEB_PORT=${plan.ports.web}

# Local SQLite defaults
DATABASE_URL=file:./var/${databaseName}.sqlite
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_CORS_ORIGINS=${urls.web},http://127.0.0.1:${plan.ports.web}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${demo.userId}
TOPOGRAM_DEMO_USER_ID=${demo.userId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true
`;
  }

  return `# Environment profile
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.environment.profile}

# Local stack ports
DB_PORT=5432
SERVER_PORT=${plan.ports.server}
WEB_PORT=${plan.ports.web}

# Local Postgres defaults
POSTGRES_DB=${databaseName}
POSTGRES_USER=\${USER:-postgres}
POSTGRES_PASSWORD=postgres

# Local shell/runtime defaults
DATABASE_URL=postgresql://\${POSTGRES_USER}@localhost:5432/${databaseName}?schema=public
DATABASE_ADMIN_URL=postgresql://\${POSTGRES_USER}@localhost:5432/postgres
PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_CORS_ORIGINS=${urls.web},http://127.0.0.1:${plan.ports.web}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${demo.userId}
TOPOGRAM_DEMO_USER_ID=${demo.userId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true
`;
}

function renderEnvironmentPackageJson() {
  return `${JSON.stringify({
    name: "topogram-runtime-stack",
    private: true,
    scripts: {
      "db:bootstrap": "bash ./scripts/bootstrap-db.sh",
      "dev:server": "bash ./scripts/server-dev.sh",
      "dev:web": "bash ./scripts/web-dev.sh",
      dev: "bash ./scripts/stack-dev.sh",
      "docker:db": "bash ./scripts/docker-db.sh",
      "docker:stack": "bash ./scripts/docker-stack.sh"
    }
  }, null, 2)}\n`;
}

function renderEnvironmentReadme(plan) {
  const localProcessNotes = plan.projections.db.platform === "db_sqlite"
    ? "- SQLite is file-backed for this bundle; no separate DB server is required."
    : `- Make sure the Postgres server is already running before \`${plan.commands.bootstrapDb}\`.\n- \`DATABASE_URL\` and \`DATABASE_ADMIN_URL\` should point at your local or managed Postgres instance.`;
  const dockerSection = plan.orchestration.usesDocker
    ? `## Alternative Docker Workflow

- Start only the database: \`${plan.commands.dockerDb}\`
- Start the database, server, and web app in containers: \`${plan.commands.dockerStack}\`
`
    : `## Local Process Notes

- Install Node.js and npm locally before using this bundle.
${localProcessNotes}
`;

  return `# ${plan.environment.name}

This bundle packages the generated runtime into one local environment:

- \`server/\`: generated Hono + Prisma server scaffold
- \`web/\`: generated ${plan.runtimeProfiles.web === "react" ? "Vite + React Router" : "SvelteKit"} web scaffold
- \`db/\`: generated DB lifecycle bundle
${plan.files.dockerCompose ? `- \`${plan.files.dockerCompose}\`: local Postgres container` : plan.projections.db.platform === "db_sqlite" ? "- local SQLite file orchestration (no Docker files generated)" : "- local-process Postgres orchestration (no Docker files generated)"}

## Quick Start

1. Copy \`.env.example\` to \`.env\` if you want to customize defaults
2. Start the database:
   - ${plan.projections.db.platform === "db_sqlite" ? "no separate DB service is required" : plan.orchestration.usesDocker ? `\`${plan.commands.dockerDb}\`` : "use your local Postgres service"}
3. Bootstrap or migrate the database:
   - \`${plan.commands.bootstrapDb}\`
4. Start the stack:
   - \`${plan.commands.dev}\`

## Demo Seed Data

- Bootstrap seeds demo data by default
- Set \`TOPOGRAM_SEED_DEMO=false\` to skip demo seeding
- Default seeded IDs come from \`.env.example\`

${dockerSection}

## Notes

- The generated server expects ${plan.projections.db.platform === "db_sqlite" ? "SQLite plus Prisma." : "Postgres plus Prisma."}
- The generated web app talks to \`PUBLIC_TOPOGRAM_API_BASE_URL\`.
- If \`.env\` is missing, generated scripts fall back to \`.env.example\`.
- The DB lifecycle scripts remain the source of truth for greenfield bootstrap and brownfield migration.
`;
}

function renderEnvironmentLoadEnvScript() {
  return renderLoadEnvScript({ searchParentEnv: true });
}

function renderEnvironmentBootstrapDbScript(plan) {
  return renderEnvAwareShellScript([
    `if [[ "\${TOPOGRAM_ENVIRONMENT_PROFILE:-${plan.environment.profile}}" == "local_docker" ]]; then`,
    "  if ! command -v docker >/dev/null 2>&1; then",
    '    echo "Docker is required for the local_docker profile, but it is not installed." >&2',
    '    echo "Set TOPOGRAM_ENVIRONMENT_PROFILE=local_process and point DATABASE_URL at a working local database, or install Docker." >&2',
    "    exit 1",
    "  fi",
    '  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db',
    "fi",
    '(cd "$ROOT_DIR/db" && bash ./scripts/db-bootstrap-or-migrate.sh)',
    'if [[ "${TOPOGRAM_SEED_DEMO:-true}" != "false" ]]; then',
    '(cd "$ROOT_DIR/server" && npm install && npm exec -- prisma generate --schema prisma/schema.prisma && npm exec -- prisma db push --schema prisma/schema.prisma --skip-generate && npm run seed:demo)',
    "fi"
  ]);
}

function renderEnvironmentServerDevScript(plan) {
  return renderEnvAwareShellScript([
    'node "$SCRIPT_DIR/guard-ports.mjs" server',
    "",
    `export PORT="\${SERVER_PORT:-${plan.ports.server}}"`,
    `export TOPOGRAM_CORS_ORIGINS="\${TOPOGRAM_CORS_ORIGINS:-http://localhost:\${WEB_PORT:-${plan.ports.web}},http://127.0.0.1:\${WEB_PORT:-${plan.ports.web}}}"`,
    "",
    'cd "$ROOT_DIR/server"',
    "npm install",
    "npm exec -- prisma generate --schema prisma/schema.prisma",
    "npm run dev"
  ]);
}

function renderEnvironmentWebDevScript(plan) {
  return renderEnvAwareShellScript([
    'node "$SCRIPT_DIR/guard-ports.mjs" web',
    "",
    `export PUBLIC_TOPOGRAM_API_BASE_URL="\${PUBLIC_TOPOGRAM_API_BASE_URL:-http://localhost:\${SERVER_PORT:-${plan.ports.server}}}"`,
    `export TOPOGRAM_CORS_ORIGINS="\${TOPOGRAM_CORS_ORIGINS:-http://localhost:\${WEB_PORT:-${plan.ports.web}},http://127.0.0.1:\${WEB_PORT:-${plan.ports.web}}}"`,
    "",
    'cd "$ROOT_DIR/web"',
    "npm install",
    `npm run dev -- --host "\${WEB_HOST:-127.0.0.1}" --port "\${WEB_PORT:-${plan.ports.web}}"`,
  ]);
}

function renderEnvironmentStackDevScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/guard-ports.mjs" stack

bash "$SCRIPT_DIR/bootstrap-db.sh"

bash "$SCRIPT_DIR/server-dev.sh" &
SERVER_PID=$!
bash "$SCRIPT_DIR/web-dev.sh" &
WEB_PID=$!

cleanup() {
  kill "$SERVER_PID" "$WEB_PID" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
wait
`;
}

function renderEnvironmentGuardPortsScript(plan) {
  return `#!/usr/bin/env node
import net from "node:net";

const role = process.argv[2] || "stack";
const serverPort = Number(process.env.SERVER_PORT || "${plan.ports.server}");
const webPort = Number(process.env.WEB_PORT || "${plan.ports.web}");
const expectedService = ${JSON.stringify(plan.runtimeReference.serviceName || "")};

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve(Boolean(error && error.code === "EADDRINUSE"));
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function readHealth(port) {
  try {
    const response = await fetch(\`http://127.0.0.1:\${port}/health\`);
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch {
    return null;
  }
}

async function failForServerPort(port) {
  const health = await readHealth(port);
  if (health?.body?.service && expectedService && health.body.service !== expectedService) {
    console.error(\`Port \${port} is already serving \${health.body.service}, not \${expectedService}.\`);
    console.error("Stop the other stack or override SERVER_PORT/PUBLIC_TOPOGRAM_API_BASE_URL before retrying.");
    process.exit(1);
  }
  if (health?.body?.service) {
    console.error(\`Port \${port} is already in use by \${health.body.service}.\`);
  } else {
    console.error(\`Port \${port} is already in use.\`);
  }
  process.exit(1);
}

async function failForWebPort(port) {
  console.error(\`Port \${port} is already in use.\`);
  console.error("Stop the other web dev server or override WEB_PORT before retrying.");
  process.exit(1);
}

if (role === "server" || role === "stack") {
  if (await portInUse(serverPort)) {
    await failForServerPort(serverPort);
  }
}

if (role === "web" || role === "stack") {
  if (await portInUse(webPort)) {
    await failForWebPort(webPort);
  }
}
`;
}

function renderEnvironmentDockerDbScript() {
  return renderRootShellScript(['docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db']);
}

function renderEnvironmentDockerStackScript() {
  return renderRootShellScript(['docker compose -f "$ROOT_DIR/docker-compose.yml" up --build']);
}

function renderEnvironmentDockerCompose(plan) {
  return `services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${plan.runtimeReference.environment.databaseName || "topogram_app"}}
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  server:
    image: node:22-alpine
    working_dir: /app
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER:-postgres}:\${POSTGRES_PASSWORD:-postgres}@db:5432/\${POSTGRES_DB:-${plan.runtimeReference.environment.databaseName || "topogram_app"}}?schema=public
      PORT: \${SERVER_PORT:-${plan.ports.server}}
      TOPOGRAM_CORS_ORIGINS: http://localhost:\${WEB_PORT:-${plan.ports.web}},http://127.0.0.1:\${WEB_PORT:-${plan.ports.web}}
    ports:
      - "127.0.0.1:\${SERVER_PORT:-${plan.ports.server}}:\${SERVER_PORT:-${plan.ports.server}}"
    volumes:
      - ./server:/app
    command: >
      sh -lc "npm install &&
      npm exec -- prisma generate --schema prisma/schema.prisma &&
      npm run dev"

  web:
    image: node:22-alpine
    working_dir: /app
    depends_on:
      - server
    environment:
      PUBLIC_TOPOGRAM_API_BASE_URL: http://localhost:\${SERVER_PORT:-${plan.ports.server}}
    ports:
      - "127.0.0.1:\${WEB_PORT:-${plan.ports.web}}:\${WEB_PORT:-${plan.ports.web}}"
    volumes:
      - ./web:/app
    command: >
      sh -lc "npm install &&
      npm run dev -- --host 0.0.0.0 --port \${WEB_PORT:-${plan.ports.web}}"

volumes:
  postgres-data:
`;
}

export function generateEnvironmentBundle(graph, options = {}) {
  const plan = buildEnvironmentPlan(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const files = {
    ".env.example": renderEnvironmentEnvExample(plan),
    ".gitignore": "node_modules/\n.env\npostgres-data/\n",
    "README.md": renderEnvironmentReadme(plan),
    "package.json": renderEnvironmentPackageJson(),
    "scripts/load-env.sh": renderEnvironmentLoadEnvScript(),
    "scripts/bootstrap-db.sh": renderEnvironmentBootstrapDbScript(plan),
    "scripts/server-dev.sh": renderEnvironmentServerDevScript(plan),
    "scripts/web-dev.sh": renderEnvironmentWebDevScript(plan),
    "scripts/stack-dev.sh": renderEnvironmentStackDevScript(),
    "scripts/guard-ports.mjs": renderEnvironmentGuardPortsScript(plan)
  };

  if (plan.orchestration.usesDocker) {
    files["docker-compose.yml"] = renderEnvironmentDockerCompose(plan);
    files["scripts/docker-db.sh"] = renderEnvironmentDockerDbScript();
    files["scripts/docker-stack.sh"] = renderEnvironmentDockerStackScript();
  }

  const serverBundle = generateServerBundle(graph, apiProjection.id);
  const webBundle = generateWebBundle(graph, uiProjection.id);
  const dbBundle = generateDbBundle(graph, dbProjection.id);

  mergeNamedBundles(files, {
    server: serverBundle,
    web: webBundle,
    db: dbBundle
  });

  return files;
}

export function generateEnvironmentPlan(graph, options = {}) {
  return buildEnvironmentPlan(graph, options);
}
