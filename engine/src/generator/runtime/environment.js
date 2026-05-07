import { generateDbLifecyclePlan } from "../surfaces/databases/lifecycle-shared.js";
import { getExampleImplementation } from "../../example-implementation.js";
import {
  generateDbBundle,
  generateServerBundle,
  generateWebBundle,
  dbEnvVarsForComponent,
  getDefaultEnvironmentProjections,
  resolveRuntimeTopology,
  runtimeDemoUserId,
  runtimePorts,
  runtimeUrls
} from "./shared.js";
import { mergeNamedBundles, renderEnvAwareShellScript, renderLoadEnvScript, renderRootShellScript } from "./bundle-shared.js";
import { generatorProfile as manifestGeneratorProfile } from "../registry.js";

function projectionHintProfile(projection, fallback) {
  if (!projection) {
    return fallback;
  }
  for (const entry of projection.generatorDefaults || []) {
    if (entry.key === "profile" && entry.value != null) {
      return entry.value;
    }
  }
  return fallback;
}

function runtimeReferenceFor(graph, options = {}) {
  try {
    return getExampleImplementation(graph, options).runtime.reference;
  } catch {
    return {
      environment: { name: "Topogram Runtime", databaseName: "topogram_app", envExample: "" },
      ports: { server: 3000, web: 5173 },
      demoEnv: { userId: "11111111-1111-4111-8111-111111111111" }
    };
  }
}

function buildEnvironmentPlan(graph, options = {}) {
  const runtimeReference = runtimeReferenceFor(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const { apiProjection, uiProjection, dbProjection } = getDefaultEnvironmentProjections(graph, options);
  const dbLifecycle = dbProjection ? generateDbLifecyclePlan(graph, { ...options, projectionId: dbProjection.id }) : null;
  const dbEngine = dbLifecycle?.engine || null;
  const profile = options.profileId || (dbEngine === "sqlite" || !dbProjection ? "local_process" : "local_docker");
  const usesDocker = profile === "local_docker";
  const webProfile = manifestGeneratorProfile(topology.primaryWeb?.generator?.id, null) || projectionHintProfile(uiProjection, "sveltekit");
  const isSqlite = dbEngine === "sqlite";
  const ports = runtimePorts(runtimeReference, topology);

  return {
    type: "environment_plan",
    environment: {
      id: [apiProjection?.id, uiProjection?.id, dbProjection?.id].filter(Boolean).join("__") || "topogram_runtime",
      name: runtimeReference.environment.name,
      mode: "local_dev",
      profile
    },
    topology: {
      runtimes: topology.runtimes.map((runtime) => ({
        id: runtime.id,
        kind: runtime.kind,
        projection: runtime.projection.id,
        generator: runtime.generator,
        port: runtime.port ?? null,
        uses_api: runtime.api || null,
        uses_database: runtime.database || null
      }))
    },
    projections: {
      api: {
        id: apiProjection?.id || null,
        type: apiProjection?.type || null
      },
      ui: {
        id: uiProjection?.id || null,
        type: uiProjection?.type || null
      },
      db: {
        id: dbProjection?.id || null,
        type: dbProjection?.type || null,
        engine: dbEngine,
        profile: dbProjection?.generatorDefaults?.profile || dbProjection?.profile || null
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
      orm: dbLifecycle?.runtimeProfile || null,
      database: dbLifecycle?.dbProfile || null
    },
    orchestration: {
      usesDocker,
      database: !dbProjection
        ? "none"
        : isSqlite
        ? "local_process_sqlite"
        : usesDocker
          ? "docker_postgres"
          : "local_process_postgres"
    },
    directories: {
      server: topology.primaryApi ? topology.serviceDir(topology.primaryApi) : null,
      web: topology.primaryWeb ? topology.webDir(topology.primaryWeb) : null,
      db: topology.primaryDb ? topology.dbDir(topology.primaryDb) : null,
      scripts: "scripts"
    },
    runtimes: {
      apis: topology.apiComponents.map((component) => ({
        id: component.id,
        projection: component.projection.id,
        port: component.port || ports.server,
        dir: topology.serviceDir(component),
        uses_database: component.database,
        databaseEnv: component.databaseComponent
          ? dbEnvVarsForComponent(component.databaseComponent, { primary: component.databaseComponent?.id === topology.primaryDb?.id })
          : null
      })),
      webs: topology.webComponents.map((component) => ({
        id: component.id,
        projection: component.projection.id,
        port: component.port || ports.web,
        dir: topology.webDir(component),
        uses_api: component.api
      })),
      databases: topology.dbComponents.map((component) => ({
        id: component.id,
        projection: component.projection.id,
        type: component.projection.type,
        engine: component.id === topology.primaryDb?.id ? dbEngine : null,
        port: component.port,
        dir: topology.dbDir(component),
        env: dbEnvVarsForComponent(component, { primary: component.id === topology.primaryDb?.id })
      }))
    },
    ports: {
      database: !dbProjection || isSqlite ? null : topology.primaryDb?.port || 5432,
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
  const demoUserId = runtimeDemoUserId(plan.runtimeReference);
  const databaseName = plan.runtimeReference.environment.databaseName || "topogram_app";
  const urls = runtimeUrls(plan.runtimeReference, {
    primaryApi: { port: plan.ports.server },
    primaryWeb: { port: plan.ports.web }
  });
  const extraDatabaseLines = plan.runtimes.databases
    .filter((component) => component.id !== plan.runtimes.databases[0]?.id)
    .map((component) => {
      const fallbackName = `${databaseName}_${component.id}`;
      if (component.engine === "sqlite") {
        return `${component.env.databaseUrl}=file:./var/${component.id}.sqlite`;
      }
      return [
        `${component.env.dbPort}=${component.port || 5432}`,
        `${component.env.postgresDb}=${fallbackName}`,
        `${component.env.databaseUrl}=postgresql://\${POSTGRES_USER}@localhost:${component.port || 5432}/${fallbackName}?schema=public`,
        `${component.env.databaseAdminUrl}=postgresql://\${POSTGRES_USER}@localhost:${component.port || 5432}/postgres`
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n");
  const commonLines = `# Environment profile
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.environment.profile}

# Local stack ports
${plan.runtimes.apis.length ? `SERVER_PORT=${plan.ports.server}\n` : ""}${plan.runtimes.webs.length ? `WEB_PORT=${plan.ports.web}\n` : ""}${plan.runtimes.webs.length && plan.runtimes.apis.length ? `PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}\n` : ""}${plan.runtimes.webs.length ? `TOPOGRAM_CORS_ORIGINS=${urls.web},http://127.0.0.1:${plan.ports.web}\n` : ""}PUBLIC_TOPOGRAM_DEMO_USER_ID=${demoUserId}
TOPOGRAM_DEMO_USER_ID=${demoUserId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true
`;
  if (!plan.projections.db.type) {
    return commonLines;
  }
  if (plan.projections.db.engine === "sqlite") {
    return `# Environment profile
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.environment.profile}

# Local stack ports
SERVER_PORT=${plan.ports.server}
WEB_PORT=${plan.ports.web}

# Local SQLite defaults
DATABASE_URL=file:./var/${databaseName}.sqlite
${extraDatabaseLines ? `${extraDatabaseLines}\n` : ""}PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_CORS_ORIGINS=${urls.web},http://127.0.0.1:${plan.ports.web}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${demoUserId}
TOPOGRAM_DEMO_USER_ID=${demoUserId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true
`;
  }

  return `# Environment profile
TOPOGRAM_ENVIRONMENT_PROFILE=${plan.environment.profile}

# Local stack ports
DB_PORT=${plan.ports.database || 5432}
SERVER_PORT=${plan.ports.server}
WEB_PORT=${plan.ports.web}

# Local Postgres defaults
POSTGRES_DB=${databaseName}
POSTGRES_USER=\${USER:-postgres}
POSTGRES_PASSWORD=postgres

# Local shell/runtime defaults
DATABASE_URL=postgresql://\${POSTGRES_USER}@localhost:${plan.ports.database || 5432}/${databaseName}?schema=public
DATABASE_ADMIN_URL=postgresql://\${POSTGRES_USER}@localhost:${plan.ports.database || 5432}/postgres
${extraDatabaseLines ? `${extraDatabaseLines}\n` : ""}PUBLIC_TOPOGRAM_API_BASE_URL=${urls.api}
TOPOGRAM_CORS_ORIGINS=${urls.web},http://127.0.0.1:${plan.ports.web}
PUBLIC_TOPOGRAM_DEMO_USER_ID=${demoUserId}
TOPOGRAM_DEMO_USER_ID=${demoUserId}
${plan.runtimeReference.environment.envExample || ""}
TOPOGRAM_SEED_DEMO=true
`;
}

function renderEnvironmentPackageJson(plan) {
  const scripts = {
    "db:bootstrap": "bash ./scripts/bootstrap-db.sh",
    "dev:server": "bash ./scripts/server-dev.sh",
    "dev:web": "bash ./scripts/web-dev.sh",
    dev: "bash ./scripts/stack-dev.sh"
  };
  if (plan.orchestration.usesDocker) {
    scripts["docker:db"] = "bash ./scripts/docker-db.sh";
    scripts["docker:stack"] = "bash ./scripts/docker-stack.sh";
  }
  return `${JSON.stringify({
    name: "topogram-runtime-stack",
    private: true,
    scripts
  }, null, 2)}\n`;
}

function apiDatabaseExportLines(component) {
  if (!component?.databaseEnv) {
    return [];
  }
  const env = component.databaseEnv;
  return [
    `if [[ -n "\${${env.databaseUrl}:-}" ]]; then export DATABASE_URL="\${${env.databaseUrl}}"; fi`,
    `if [[ -n "\${${env.databaseAdminUrl}:-}" ]]; then export DATABASE_ADMIN_URL="\${${env.databaseAdminUrl}}"; fi`
  ];
}

function renderEnvironmentReadme(plan) {
  const hasDb = plan.runtimes.databases.length > 0;
  const hasApi = plan.runtimes.apis.length > 0;
  const hasWeb = plan.runtimes.webs.length > 0;
  const localProcessNotes = !hasDb
    ? "- This bundle has no generated database surface."
    : plan.projections.db.engine === "sqlite"
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

${hasApi ? "- `services/<api-id>/`: generated API service scaffolds\n" : ""}${hasWeb ? `- \`web/<web-id>/\`: generated ${plan.runtimeProfiles.web === "react" ? "Vite + React Router" : plan.runtimeProfiles.web === "vanilla" ? "vanilla HTML/CSS/JS" : "SvelteKit"} web scaffolds\n` : ""}${hasDb ? "- `db/<db-id>/`: generated DB lifecycle bundles\n" : ""}${plan.files.dockerCompose ? `- \`${plan.files.dockerCompose}\`: local Postgres container` : hasDb ? (plan.projections.db.engine === "sqlite" ? "- local SQLite file orchestration (no Docker files generated)" : "- local-process Postgres orchestration (no Docker files generated)") : "- no DB orchestration is generated"}

## Quick Start

1. Copy \`.env.example\` to \`.env\` if you want to customize defaults
2. Start the database:
   - ${!hasDb ? "not applicable" : plan.projections.db.engine === "sqlite" ? "no separate DB service is required" : plan.orchestration.usesDocker ? `\`${plan.commands.dockerDb}\`` : "use your local Postgres service"}
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

- ${hasApi && hasDb ? `The generated server expects ${plan.projections.db.engine === "sqlite" ? "SQLite plus Prisma." : "Postgres plus Prisma."}` : hasApi ? "The generated server is stateless." : "No server surface is generated."}
- ${hasWeb && hasApi ? "The generated web app talks to `PUBLIC_TOPOGRAM_API_BASE_URL`." : hasWeb ? "The generated web app is standalone." : "No web surface is generated."}
- If \`.env\` is missing, generated scripts fall back to \`.env.example\`.
- The DB lifecycle scripts remain the source of truth for greenfield bootstrap and brownfield migration.
`;
}

function renderEnvironmentLoadEnvScript() {
  return renderLoadEnvScript({ searchParentEnv: true });
}

function renderEnvironmentBootstrapDbScript(plan) {
  const dbBootstrapLines = plan.runtimes.databases.map((component) => {
    const env = component.env;
    const runtimeApi = plan.runtimes.apis.find((apiComponent) => apiComponent.uses_database === component.id);
    const assignments = [
      `DATABASE_URL="\${${env.databaseUrl}:-}"`,
      `DATABASE_ADMIN_URL="\${${env.databaseAdminUrl}:-}"`,
      runtimeApi ? `TOPOGRAM_RUNTIME_SERVER_DIR="$ROOT_DIR/${runtimeApi.dir}"` : null
    ].filter(Boolean).join(" ");
    return `(cd "$ROOT_DIR/${component.dir}" && TOPOGRAM_ENV_FILE=/dev/null ${assignments} bash ./scripts/db-bootstrap-or-migrate.sh)`;
  });
  const primaryApi = plan.runtimes.apis[0];
  if (plan.runtimes.databases.length === 0) {
    return renderEnvAwareShellScript([
      'echo "No database runtimes are configured; skipping DB bootstrap."'
    ]);
  }
  return renderEnvAwareShellScript([
    `if [[ "\${TOPOGRAM_ENVIRONMENT_PROFILE:-${plan.environment.profile}}" == "local_docker" ]]; then`,
    "  if ! command -v docker >/dev/null 2>&1; then",
    '    echo "Docker is required for the local_docker profile, but it is not installed." >&2',
    '    echo "Set TOPOGRAM_ENVIRONMENT_PROFILE=local_process and point DATABASE_URL at a working local database, or install Docker." >&2',
    "    exit 1",
    "  fi",
    '  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db',
    "fi",
    ...dbBootstrapLines,
    'if [[ "${TOPOGRAM_SEED_DEMO:-true}" != "false" ]]; then',
    ...apiDatabaseExportLines(primaryApi),
    ...(primaryApi?.uses_database
      ? [`(cd "$ROOT_DIR/${primaryApi.dir}" && npm install && npm exec -- prisma generate --schema prisma/schema.prisma && npm exec -- prisma db push --schema prisma/schema.prisma --skip-generate && npm run seed:demo)`]
      : ['echo "No DB-backed API component is configured; skipping demo seed."']),
    "fi"
  ]);
}

function componentScriptOptions() {
  return {
    rootDirExpression: 'ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"',
    loadEnvScript: '"$ROOT_DIR/scripts/load-env.sh"'
  };
}

function renderEnvironmentServerDevScript(plan, component = plan.runtimes.apis[0], options = {}) {
  if (!component) {
    return renderEnvAwareShellScript(['echo "No API runtimes are configured."']);
  }
  const guardPortsScript = options.componentScript ? '"$ROOT_DIR/scripts/guard-ports.mjs"' : '"$SCRIPT_DIR/guard-ports.mjs"';
  return renderEnvAwareShellScript([
    `node ${guardPortsScript} api`,
    "",
    ...apiDatabaseExportLines(component),
    `export PORT="\${${component.id.toUpperCase()}_PORT:-\${SERVER_PORT:-${component.port}}}"`,
    `export TOPOGRAM_CORS_ORIGINS="\${TOPOGRAM_CORS_ORIGINS:-http://localhost:\${WEB_PORT:-${plan.ports.web}},http://127.0.0.1:\${WEB_PORT:-${plan.ports.web}}}"`,
    "",
    `cd "$ROOT_DIR/${component.dir}"`,
    "npm install",
    ...(component.uses_database ? ["npm exec -- prisma generate --schema prisma/schema.prisma"] : []),
    "npm run dev"
  ], options.componentScript ? componentScriptOptions() : {});
}

function renderEnvironmentWebDevScript(plan, component = plan.runtimes.webs[0], options = {}) {
  if (!component) {
    return renderEnvAwareShellScript(['echo "No web runtimes are configured."']);
  }
  const apiComponent = plan.runtimes.apis.find((entry) => entry.id === component.uses_api) || plan.runtimes.apis[0];
  const guardPortsScript = options.componentScript ? '"$ROOT_DIR/scripts/guard-ports.mjs"' : '"$SCRIPT_DIR/guard-ports.mjs"';
  return renderEnvAwareShellScript([
    `node ${guardPortsScript} web`,
    "",
    ...(apiComponent ? [`export PUBLIC_TOPOGRAM_API_BASE_URL="\${PUBLIC_TOPOGRAM_API_BASE_URL:-http://localhost:\${${apiComponent.id.toUpperCase()}_PORT:-\${SERVER_PORT:-${apiComponent.port}}}}"`] : []),
    `export TOPOGRAM_CORS_ORIGINS="\${TOPOGRAM_CORS_ORIGINS:-http://localhost:\${${component.id.toUpperCase()}_PORT:-\${WEB_PORT:-${component.port}}},http://127.0.0.1:\${${component.id.toUpperCase()}_PORT:-\${WEB_PORT:-${component.port}}}}"`,
    "",
    `cd "$ROOT_DIR/${component.dir}"`,
    "npm install",
    `npm run dev -- --host "\${WEB_HOST:-127.0.0.1}" --port "\${${component.id.toUpperCase()}_PORT:-\${WEB_PORT:-${component.port}}}"`,
  ], options.componentScript ? componentScriptOptions() : {});
}

function renderEnvironmentStackDevScript(plan) {
  const startLines = [
    ...plan.runtimes.apis.map((component) => `bash "$SCRIPT_DIR/services/${component.id}-dev.sh" &\nPIDS+=($!)`),
    ...plan.runtimes.webs.map((component) => `bash "$SCRIPT_DIR/web/${component.id}-dev.sh" &\nPIDS+=($!)`)
  ];
  return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

node "$SCRIPT_DIR/guard-ports.mjs" stack

if [[ "\${TOPOGRAM_SKIP_STACK_BOOTSTRAP:-false}" != "true" ]]; then
  bash "$SCRIPT_DIR/bootstrap-db.sh"
fi

${startLines.length ? startLines.join("\n") : 'echo "No long-running dev services are configured."'}

kill_tree() {
  local pid="$1"
  local child
  while IFS= read -r child; do
    [[ -n "$child" ]] && kill_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  if [[ "\${#PIDS[@]}" -gt 0 ]]; then
    for pid in "\${PIDS[@]}"; do
      kill_tree "$pid"
    done
  fi
}

trap cleanup EXIT INT TERM
${startLines.length ? "wait" : ""}
`;
}

function renderEnvironmentGuardPortsScript(plan) {
  const ports = [
    ...plan.runtimes.apis.map((component) => ({ id: component.id, type: "api", env: `${component.id.toUpperCase()}_PORT`, fallbackEnv: "SERVER_PORT", port: component.port })),
    ...plan.runtimes.webs.map((component) => ({ id: component.id, type: "web", env: `${component.id.toUpperCase()}_PORT`, fallbackEnv: "WEB_PORT", port: component.port }))
  ];
  return `#!/usr/bin/env node
import net from "node:net";

const role = process.argv[2] || "stack";
const ports = ${JSON.stringify(ports, null, 2)};
const expectedService = ${JSON.stringify(plan.runtimeReference.serviceName || "")};

function effectivePort(entry) {
  return Number(process.env[entry.env] || process.env[entry.fallbackEnv] || entry.port);
}

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

for (const entry of ports) {
  if (role !== "stack" && role !== entry.type) {
    continue;
  }
  const port = effectivePort(entry);
  if (await portInUse(port)) {
    if (entry.type === "api") {
      await failForServerPort(port);
    }
    await failForWebPort(port);
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
      - ./${plan.directories.server}:/app
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
      - ./${plan.directories.web}:/app
    command: >
      sh -lc "npm install &&
      npm run dev -- --host 0.0.0.0 --port \${WEB_PORT:-${plan.ports.web}}"

volumes:
  postgres-data:
`;
}

export function generateEnvironmentBundle(graph, options = {}) {
  const plan = buildEnvironmentPlan(graph, options);
  const topology = resolveRuntimeTopology(graph, options);
  const files = {
    ".env.example": renderEnvironmentEnvExample(plan),
    ".gitignore": "node_modules/\n.env\npostgres-data/\n",
    "README.md": renderEnvironmentReadme(plan),
    "package.json": renderEnvironmentPackageJson(plan),
    "scripts/load-env.sh": renderEnvironmentLoadEnvScript(),
    "scripts/bootstrap-db.sh": renderEnvironmentBootstrapDbScript(plan),
    "scripts/server-dev.sh": renderEnvironmentServerDevScript(plan),
    "scripts/web-dev.sh": renderEnvironmentWebDevScript(plan),
    "scripts/stack-dev.sh": renderEnvironmentStackDevScript(plan),
    "scripts/guard-ports.mjs": renderEnvironmentGuardPortsScript(plan)
  };

  for (const component of plan.runtimes.apis) {
    files[`scripts/services/${component.id}-dev.sh`] = renderEnvironmentServerDevScript(plan, component, { componentScript: true });
  }
  for (const component of plan.runtimes.webs) {
    files[`scripts/web/${component.id}-dev.sh`] = renderEnvironmentWebDevScript(plan, component, { componentScript: true });
  }

  if (plan.orchestration.usesDocker) {
    files["docker-compose.yml"] = renderEnvironmentDockerCompose(plan);
    files["scripts/docker-db.sh"] = renderEnvironmentDockerDbScript();
    files["scripts/docker-stack.sh"] = renderEnvironmentDockerStackScript();
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

export function generateEnvironmentPlan(graph, options = {}) {
  return buildEnvironmentPlan(graph, options);
}
