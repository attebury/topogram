// @ts-check

import { generateApiContractGraph } from "../../api.js";
import { generateWithComponentGenerator } from "../../adapters.js";
import { getProjection } from "../../surfaces/databases/shared.js";
import { getDefaultBackendDbProjection } from "../../../realization/backend/index.js";
import { defaultProjectConfigForGraph, validateProjectConfig } from "../../../project-config.js";

/**
 * @typedef {Object} ResolvedGraph
 * @property {Record<string, Array<Record<string, any>>>} byKind
 * @property {string} [root]
 */

/**
 * @typedef {Record<string, any>} RuntimeStatement
 */

/**
 * @typedef {Object} RuntimeComponent
 * @property {string} id
 * @property {"api_service"|"web_surface"|"ios_surface"|"android_surface"|"database"} kind
 * @property {string} [type]
 * @property {RuntimeStatement} projection
 * @property {import("../../../project-config.js").GeneratorBinding} generator
 * @property {number|null} [port]
 * @property {string|null} [api]
 * @property {string|null} [database]
 * @property {Record<string, string>} [env]
 * @property {import("../../../project-config.js").RuntimeMigrationStrategy} [migration]
 * @property {RuntimeComponent|null} [apiRuntime]
 * @property {RuntimeComponent|null} [databaseRuntime]
 * @property {RuntimeComponent|null} [apiComponent] Legacy adapter alias for apiRuntime.
 * @property {RuntimeComponent|null} [databaseComponent] Legacy adapter alias for databaseRuntime.
 */

/**
 * @typedef {import("../../../project-config.js").RuntimeTopologyRuntime} RuntimeTopologyComponent
 */

/**
 * @typedef {Object} RuntimeTopology
 * @property {import("../../../project-config.js").ProjectConfig} config
 * @property {RuntimeComponent[]} runtimes
 * @property {RuntimeComponent[]} apiRuntimes
 * @property {RuntimeComponent[]} webRuntimes
 * @property {RuntimeComponent[]} nativeRuntimes
 * @property {RuntimeComponent[]} dbRuntimes
 * @property {RuntimeComponent[]} components Legacy alias for runtimes.
 * @property {RuntimeComponent[]} apiComponents Legacy alias for apiRuntimes.
 * @property {RuntimeComponent[]} webComponents Legacy alias for webRuntimes.
 * @property {RuntimeComponent[]} nativeComponents Legacy alias for nativeRuntimes.
 * @property {RuntimeComponent[]} dbComponents Legacy alias for dbRuntimes.
 * @property {RuntimeComponent|null} primaryApi
 * @property {RuntimeComponent|null} primaryWeb
 * @property {RuntimeComponent|null} primaryDb
 * @property {(component: RuntimeComponent) => string} serviceDir
 * @property {(component: RuntimeComponent) => string} webDir
 * @property {(component: RuntimeComponent) => string} nativeDir
 * @property {(component: RuntimeComponent) => string} dbDir
 */

/**
 * @typedef {Object} VerificationSelectionOptions
 * @property {boolean} [keepLookupChecks]
 * @property {boolean} [keepWebChecks]
 */

/**
 * @typedef {Object} RuntimeGenerationOptions
 * @property {import("../../../project-config.js").ProjectConfig} [projectConfig]
 * @property {Record<string, any>|null} [implementation]
 * @property {string} [projectionId]
 * @property {string} [dbProjectionId]
 * @property {string} [configDir]
 * @property {string} [projectRoot]
 * @property {RuntimeComponent} [runtime]
 * @property {RuntimeComponent} [component] Legacy alias for runtime.
 */

/**
 * @typedef {Object} EnvVarOptions
 * @property {boolean} [primary]
 */

/**
 * @param {any} item
 * @returns {string|null}
 */
function verificationScenarioValue(item) {
  if (!item) {
    return null;
  }
  if (typeof item === "string") {
    return item;
  }
  return item.value || null;
}

/**
 * @param {any} scenario
 * @returns {string}
 */
function scenarioLabel(scenario) {
  return String(scenario || "")
    .replace(/^verify_/, "")
    .replaceAll("_", " ")
    .trim();
}

/**
 * @param {ResolvedGraph} graph
 * @param {string[]} [methods]
 * @returns {RuntimeStatement[]}
 */
export function getVerificationEntries(graph, methods = []) {
  const methodSet = new Set(methods);
  return (graph.byKind.verification || [])
    .filter((verification) => methodSet.size === 0 || methodSet.has(verification.method))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * @param {ResolvedGraph} graph
 * @param {string[]} [methods]
 * @returns {Record<string, any>|null}
 */
export function buildVerificationSummary(graph, methods = []) {
  const verifications = getVerificationEntries(graph, methods);
  if (verifications.length === 0) {
    return null;
  }

  const scenarioMap = new Map();
  for (const verification of verifications) {
    const rawScenarios = Array.isArray(verification.scenarios)
      ? verification.scenarios
      : Array.isArray(verification.plan?.scenarios)
        ? /** @type {Array<Record<string, any>>} */ (verification.plan.scenarios).map((entry) => entry?.target?.id || null)
        : [];
    for (const raw of rawScenarios) {
      const id = verificationScenarioValue(raw);
      if (!id || scenarioMap.has(id)) {
        continue;
      }
      scenarioMap.set(id, {
        id,
        label: scenarioLabel(id)
      });
    }
  }

  return {
    methods: [...new Set(verifications.map((verification) => verification.method))],
    sources: verifications.map((verification) => ({
      id: verification.id,
      name: verification.name || verification.id,
      method: verification.method,
      validates: /** @type {Array<Record<string, any>>} */ (verification.validates || []).map((item) => item.id)
    })),
    scenarios: [...scenarioMap.values()]
  };
}

/**
 * @param {ResolvedGraph} graph
 * @param {string[]} [methods]
 * @returns {Set<string>}
 */
export function getVerifiedCapabilityIds(graph, methods = []) {
  const verifications = getVerificationEntries(graph, methods);
  const capabilityIds = new Set();
  for (const verification of verifications) {
    for (const target of verification.validates || []) {
      if (target.kind === "capability") {
        capabilityIds.add(target.id);
      }
    }
  }
  return capabilityIds;
}

/**
 * @param {ResolvedGraph} graph
 * @param {Array<Record<string, any>>} checks
 * @param {string[]} [methods]
 * @param {VerificationSelectionOptions} [options]
 * @returns {{ checks: Array<Record<string, any>>, selection: Record<string, any>|null }}
 */
export function selectChecksByVerification(graph, checks, methods = [], options = {}) {
  const capabilityIds = getVerifiedCapabilityIds(graph, methods);
  if (capabilityIds.size === 0) {
    return {
      checks,
      selection: null
    };
  }

  const selected = [];
  const selectedCheckIds = [];
  const omittedCheckIds = [];

  for (const check of checks) {
    const keepLookup = options.keepLookupChecks && check.kind === "lookup_contract";
    const keepWeb = options.keepWebChecks && (check.kind === "web_contract" || check.type === "web_get");
    const matchesCapability = check.capabilityId && capabilityIds.has(check.capabilityId);
    const keep = keepLookup || keepWeb || matchesCapability;

    if (keep) {
      selected.push(check);
      selectedCheckIds.push(check.id);
    } else {
      omittedCheckIds.push(check.id);
    }
  }

  return {
    checks: selected.length > 0 ? selected : checks,
    selection: {
      methods,
      capabilityIds: [...capabilityIds].sort(),
      selectedCheckIds,
      omittedCheckIds
    }
  };
}

/**
 * @param {ResolvedGraph} graph
 * @returns {RuntimeStatement[]}
 */
function apiProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter((projection) => (projection.http || []).length > 0);
}

/**
 * @param {ResolvedGraph} graph
 * @returns {RuntimeStatement[]}
 */
function uiWebProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter(
    (projection) => projection.type === "web_surface" && (projection.uiRoutes || []).length > 0
  );
}

const WEB_UI_FAMILY_PREFIX = "proj_web_surface__";
const NATIVE_UI_FAMILY_PREFIX = "proj_ios_surface__";

/** Prefer canonical ids when multiple shipped web stacks exist (deterministic, not lexicographic). */
const DEFAULT_WEB_UI_STACK_ORDER = ["proj_web_surface__sveltekit", "proj_web_surface__react"];

const DEFAULT_NATIVE_UI_PLATFORM_ORDER = ["proj_ios_surface__swiftui"];

/**
 * @param {ResolvedGraph} graph
 * @returns {RuntimeStatement[]}
 */
function uiIosProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter(
    (projection) => projection.type === "ios_surface" && (projection.uiRoutes || []).length > 0
  );
}

/**
 * Prefer canonical native projections (`proj_ios_surface__{stack}`); otherwise first routed iOS surface projection.
 *
 * @param {ResolvedGraph} graph
 * @returns {RuntimeStatement|undefined}
 */
export function pickDefaultIosUiProjection(graph) {
  const candidates = uiIosProjectionCandidates(graph);
  const hierarchical = candidates.filter((projection) => projection.id.startsWith(NATIVE_UI_FAMILY_PREFIX));
  if (hierarchical.length > 0) {
    for (const id of DEFAULT_NATIVE_UI_PLATFORM_ORDER) {
      const match = hierarchical.find((projection) => projection.id === id);
      if (match) {
        return match;
      }
    }
    return hierarchical.sort((a, b) => a.id.localeCompare(b.id))[0];
  }
  return candidates[0];
}

/**
 * Prefer canonical shipped web projections (`proj_web_surface__{stack}`); otherwise first routed web surface projection.
 *
 * @param {ResolvedGraph} graph
 * @returns {RuntimeStatement|undefined}
 */
export function pickDefaultUiWebProjection(graph) {
  const candidates = uiWebProjectionCandidates(graph);
  const hierarchical = candidates.filter((projection) => projection.id.startsWith(WEB_UI_FAMILY_PREFIX));
  if (hierarchical.length > 0) {
    for (const id of DEFAULT_WEB_UI_STACK_ORDER) {
      const match = hierarchical.find((projection) => projection.id === id);
      if (match) {
        return match;
      }
    }
    return hierarchical.sort((a, b) => a.id.localeCompare(b.id))[0];
  }
  return candidates[0];
}

/**
 * @param {ResolvedGraph} graph
 * @param {RuntimeGenerationOptions} [options]
 * @returns {{ apiProjection: RuntimeStatement|null, uiProjection: RuntimeStatement|null, dbProjection: RuntimeStatement|null }}
 */
export function getDefaultEnvironmentProjections(graph, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const dbCandidates = graph.byKind.projection?.filter((projection) => ["db_contract", "db_contract"].includes(projection.type)) || [];
  const apiProjection = /** @type {RuntimeStatement|null} */ (topology.primaryApi?.projection ||
    (options.projectionId ? getProjection(graph, options.projectionId) : null) ||
    apiProjectionCandidates(graph).find((projection) => projection.id === "proj_api") ||
    apiProjectionCandidates(graph)[0] ||
    null);
  const uiProjection = /** @type {RuntimeStatement|null} */ (topology.primaryWeb?.projection || pickDefaultUiWebProjection(graph) || null);
  let dbProjection = /** @type {RuntimeStatement|null} */ (topology.primaryDb?.projection || null);
  if (!dbProjection && dbCandidates.length > 0) {
    try {
      dbProjection = getDefaultBackendDbProjection(graph, options);
    } catch {
      dbProjection = /** @type {RuntimeStatement|null} */ (dbCandidates[0] || null);
    }
  }

  return { apiProjection, uiProjection, dbProjection };
}

/**
 * @param {ResolvedGraph} graph
 * @param {string} projectionId
 * @param {RuntimeGenerationOptions} [options]
 * @returns {any}
 */
export function generateServerBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const runtime = options.runtime || options.component || topology.apiRuntimes.find((entry) => entry.projection.id === projectionId);
  if (!runtime) {
    throw new Error(`No api runtime found for projection '${projectionId}'`);
  }
  return generateWithComponentGenerator({
    graph,
    projection: runtime.projection,
    runtime,
    component: runtime,
    topology,
    implementation: options.implementation || null,
    options: { ...options, projectionId }
  }).files;
}

/**
 * @param {ResolvedGraph} graph
 * @param {string} projectionId
 * @param {RuntimeGenerationOptions} [options]
 * @returns {any}
 */
export function generateWebBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const runtime = options.runtime || options.component || topology.webRuntimes.find((entry) => entry.projection.id === projectionId);
  if (!runtime) {
    throw new Error(`No web runtime found for projection '${projectionId}'`);
  }
  return generateWithComponentGenerator({
    graph,
    projection: runtime.projection,
    runtime,
    component: runtime,
    topology,
    implementation: options.implementation || null,
    options: { ...options, projectionId }
  }).files;
}

/**
 * @param {ResolvedGraph} graph
 * @param {string} projectionId
 * @param {RuntimeGenerationOptions} [options]
 * @returns {any}
 */
export function generateNativeBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const runtime = options.runtime || options.component || topology.nativeRuntimes.find((entry) => entry.projection.id === projectionId);
  if (!runtime) {
    throw new Error(`No native runtime found for projection '${projectionId}'`);
  }
  return generateWithComponentGenerator({
    graph,
    projection: runtime.projection,
    runtime,
    component: runtime,
    topology,
    implementation: options.implementation || null,
    options: { ...options, projectionId }
  }).files;
}

/**
 * @param {ResolvedGraph} graph
 * @param {string} projectionId
 * @param {RuntimeGenerationOptions} [options]
 * @returns {any}
 */
export function generateDbBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const runtime = options.runtime || options.component || topology.dbRuntimes.find((entry) => entry.projection.id === projectionId);
  if (!runtime) {
    throw new Error(`No database runtime found for projection '${projectionId}'`);
  }
  return generateWithComponentGenerator({
    graph,
    projection: getProjection(graph, projectionId),
    runtime,
    component: runtime,
    topology,
    implementation: options.implementation || null,
    options: { ...options, projectionId }
  }).files;
}

/**
 * @param {ResolvedGraph} graph
 * @returns {any}
 */
export function generateRuntimeApiContracts(graph) {
  return generateApiContractGraph(graph, {});
}

/**
 * @param {string} runtimeId
 * @param {EnvVarOptions} [options]
 * @returns {string}
 */
function envVarPrefix(runtimeId, options = {}) {
  return options.primary || runtimeId === "db"
    ? ""
    : `${runtimeId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_`;
}

/**
 * @param {RuntimeComponent} component
 * @param {EnvVarOptions} [options]
 * @returns {{ databaseUrl: string, databaseAdminUrl: string, dbPort: string, postgresDb: string }}
 */
export function dbEnvVarsForComponent(component, options = {}) {
  const prefix = envVarPrefix(component.id, options);
  return {
    databaseUrl: component.env?.databaseUrl || `${prefix}DATABASE_URL`,
    databaseAdminUrl: component.env?.databaseAdminUrl || `${prefix}DATABASE_ADMIN_URL`,
    dbPort: component.env?.dbPort || `${prefix}DB_PORT`,
    postgresDb: component.env?.postgresDb || `${prefix}POSTGRES_DB`
  };
}

/**
 * @param {ResolvedGraph} graph
 * @param {import("../../../project-config.js").ProjectConfig} config
 * @returns {RuntimeComponent[]}
 */
function decorateRuntimes(graph, config) {
  const byProjectionId = new Map((graph.byKind.projection || []).map((projection) => [projection.id, projection]));
  const rawRuntimes = config.topology?.runtimes || [];
  /** @type {RuntimeComponent[]} */
  const runtimes = rawRuntimes.map((runtime) => ({
    ...runtime,
    kind: runtime.kind || null,
    api: runtime.uses_api ?? null,
    database: runtime.uses_database ?? null,
    projection: byProjectionId.get(runtime.projection) || {}
  }));
  const byId = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
  for (const runtime of runtimes) {
    if (runtime.kind === "api_service" && runtime.database) {
      runtime.databaseRuntime = byId.get(runtime.database) || null;
      runtime.databaseComponent = runtime.databaseRuntime;
    }
    if (["web_surface", "ios_surface", "android_surface"].includes(runtime.kind) && runtime.api) {
      runtime.apiRuntime = byId.get(runtime.api) || null;
      runtime.apiComponent = runtime.apiRuntime;
    }
  }
  return runtimes;
}

/**
 * @param {ResolvedGraph} graph
 * @param {RuntimeGenerationOptions} [options]
 * @returns {RuntimeTopology}
 */
export function resolveRuntimeTopology(graph, options = {}) {
  const config = options.projectConfig || defaultProjectConfigForGraph(graph, options.implementation || null);
  const validation = validateProjectConfig(config, graph, {
    configDir: options.configDir || options.projectRoot || null,
    rootDir: options.projectRoot || options.configDir || null
  });
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
  const runtimes = decorateRuntimes(graph, config);
  const apiRuntimes = runtimes.filter((runtime) => runtime.kind === "api_service");
  const webRuntimes = runtimes.filter((runtime) => runtime.kind === "web_surface");
  const nativeRuntimes = runtimes.filter((runtime) => runtime.kind === "ios_surface" || runtime.kind === "android_surface");
  const dbRuntimes = runtimes.filter((runtime) => runtime.kind === "database");
  const primaryApi = apiRuntimes[0] || null;
  const primaryWeb = webRuntimes[0] || null;
  const primaryDb = primaryApi?.databaseRuntime || dbRuntimes[0] || null;

  return {
    config,
    runtimes,
    components: runtimes,
    apiRuntimes,
    webRuntimes,
    nativeRuntimes,
    dbRuntimes,
    apiComponents: apiRuntimes,
    webComponents: webRuntimes,
    nativeComponents: nativeRuntimes,
    dbComponents: dbRuntimes,
    primaryApi,
    primaryWeb,
    primaryDb,
    serviceDir(component) {
      return `services/${component.id}`;
    },
    webDir(component) {
      return `web/${component.id}`;
    },
    nativeDir(component) {
      return `native/${component.id}`;
    },
    dbDir(component) {
      return `db/${component.id}`;
    }
  };
}

/**
 * @param {Record<string, any>|null|undefined} runtimeReference
 * @param {RuntimeTopology|null} [topology]
 * @returns {{ server: number, web: number }}
 */
export function runtimePorts(runtimeReference, topology = null) {
  return {
    server: topology?.primaryApi?.port || runtimeReference?.ports?.server || 3000,
    web: topology?.primaryWeb?.port || runtimeReference?.ports?.web || 5173
  };
}

/**
 * @param {Record<string, any>|null|undefined} runtimeReference
 * @param {RuntimeTopology|null} [topology]
 * @returns {{ api: string, web: string }}
 */
export function runtimeUrls(runtimeReference, topology = null) {
  const ports = runtimePorts(runtimeReference, topology);
  return {
    api: `http://localhost:${ports.server}`,
    web: `http://localhost:${ports.web}`
  };
}

/**
 * @param {Record<string, any>|null|undefined} runtimeReference
 * @returns {string}
 */
export function runtimeDemoUserId(runtimeReference) {
  const demo = runtimeReference?.demoEnv || {};
  return demo.userId || demo.memberId || demo.ownerId || demo.primaryActorId || "";
}
