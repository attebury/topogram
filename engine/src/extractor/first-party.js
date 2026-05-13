// @ts-check

export const FIRST_PARTY_EXTRACTOR_PACKAGES = [
  {
    package: "@topogram/extractor-prisma-db",
    id: "@topogram/extractor-prisma-db",
    version: "1",
    label: "Prisma DB",
    tracks: ["db"],
    stack: { orm: "prisma", domain: "database" },
    capabilities: { schema: true, migrations: true, maintainedSeams: true },
    candidateKinds: ["entity", "enum", "relation", "index", "maintained_db_migration_seam"],
    evidenceTypes: ["runtime_source", "parser_config"],
    extractors: ["db.prisma"],
    useWhen: "Use for Prisma schema.prisma models plus Prisma migration evidence.",
    extracts: ["entities", "enums", "relations", "indexes", "maintained DB seam proposals"],
    exampleSource: "./prisma-app"
  },
  {
    package: "@topogram/extractor-express-api",
    id: "@topogram/extractor-express-api",
    version: "1",
    label: "Express API",
    tracks: ["api"],
    stack: { runtime: "node", framework: "express" },
    capabilities: { routes: true, parameters: true, authHints: true },
    candidateKinds: ["capability", "route", "stack"],
    evidenceTypes: ["runtime_source", "parser_config"],
    extractors: ["api.express"],
    useWhen: "Use for Express route files, routers, params, middleware, and auth hints.",
    extracts: ["API route candidates", "capability suggestions", "parameter evidence", "auth hints", "stack evidence"],
    exampleSource: "./express-api"
  },
  {
    package: "@topogram/extractor-drizzle-db",
    id: "@topogram/extractor-drizzle-db",
    version: "1",
    label: "Drizzle DB",
    tracks: ["db"],
    stack: { orm: "drizzle", domain: "database" },
    capabilities: { schema: true, migrations: true, maintainedSeams: true },
    candidateKinds: ["entity", "enum", "relation", "index", "maintained_db_migration_seam"],
    evidenceTypes: ["runtime_source", "parser_config"],
    extractors: ["db.drizzle"],
    useWhen: "Use for Drizzle config, schema modules, table definitions, and migration output.",
    extracts: ["entities", "relations", "indexes", "maintained DB seam proposals", "schema/migration evidence"],
    exampleSource: "./drizzle-app"
  },
  {
    package: "@topogram/extractor-node-cli",
    id: "@topogram/extractor-node-cli",
    version: "1",
    label: "Node CLI",
    tracks: ["cli"],
    stack: { runtime: "node", domain: "cli" },
    capabilities: { commands: true, options: true, effects: true },
    candidateKinds: ["command", "capability", "cli_surface"],
    evidenceTypes: ["runtime_source", "parser_config"],
    extractors: ["cli.node-package"],
    useWhen: "Use for Node package CLIs with bin entries, scripts, command modules, and help text.",
    extracts: ["command candidates", "options", "effects", "CLI surface projections", "capability suggestions"],
    exampleSource: "./existing-cli"
  },
  {
    package: "@topogram/extractor-react-router",
    id: "@topogram/extractor-react-router",
    version: "1",
    label: "React Router UI",
    tracks: ["ui"],
    stack: { framework: "react-router", domain: "ui" },
    capabilities: { routes: true, screens: true, flows: true, widgets: true },
    candidateKinds: ["screen", "route", "action", "flow", "widget", "shape", "stack"],
    evidenceTypes: ["runtime_source", "parser_config"],
    extractors: ["ui.react-router"],
    useWhen: "Use for React Router route trees, route modules, screen hints, and non-resource UI flows.",
    extracts: ["screens", "routes", "flow candidates", "widget evidence", "stack evidence"],
    exampleSource: "./react-router-app"
  }
];

export const FIRST_PARTY_EXTRACTORS_BY_PACKAGE = new Map(FIRST_PARTY_EXTRACTOR_PACKAGES.map((item) => [item.package, item]));
export const FIRST_PARTY_EXTRACTORS_BY_ID = new Map(FIRST_PARTY_EXTRACTOR_PACKAGES.map((item) => [item.id, item]));

/**
 * @param {string|null|undefined} value
 * @returns {typeof FIRST_PARTY_EXTRACTOR_PACKAGES[number]|null}
 */
export function firstPartyExtractorInfo(value) {
  if (!value) {
    return null;
  }
  return FIRST_PARTY_EXTRACTORS_BY_PACKAGE.get(value) || FIRST_PARTY_EXTRACTORS_BY_ID.get(value) || null;
}
