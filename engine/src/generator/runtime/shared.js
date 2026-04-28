// @ts-check

import { generateExpressServer } from "../apps/backend/express.js";
import { generateHonoServer } from "../apps/backend/hono.js";
import { generateWebApp } from "../apps/web/index.js";
import { generateApiContractGraph } from "../api.js";
import { generateDbLifecycleBundleForProjection } from "../db/lifecycle-shared.js";
import { getProjection } from "../db/shared.js";
import { getDefaultBackendDbProjection } from "../../realization/backend/index.js";
import { defaultProjectConfigForGraph, validateProjectConfig } from "../../project-config.js";
import { generatorProfile } from "../registry.js";

/**
 * @typedef {Object} ResolvedGraph
 * @property {Record<string, Array<Record<string, any>>>} byKind
 * @property {string} [root]
 */

/**
 * @typedef {Object} RuntimeTopology
 * @property {import("../../project-config.js").ProjectConfig} config
 * @property {Array<Record<string, any>>} components
 * @property {Array<Record<string, any>>} apiComponents
 * @property {Array<Record<string, any>>} webComponents
 * @property {Array<Record<string, any>>} dbComponents
 * @property {Record<string, any>|null} primaryApi
 * @property {Record<string, any>|null} primaryWeb
 * @property {Record<string, any>|null} primaryDb
 * @property {(component: Record<string, any>) => string} serviceDir
 * @property {(component: Record<string, any>) => string} webDir
 * @property {(component: Record<string, any>) => string} dbDir
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

function scenarioLabel(scenario) {
  return String(scenario || "")
    .replace(/^verify_/, "")
    .replaceAll("_", " ")
    .trim();
}

export function getVerificationEntries(graph, methods = []) {
  const methodSet = new Set(methods);
  return (graph.byKind.verification || [])
    .filter((verification) => methodSet.size === 0 || methodSet.has(verification.method))
    .sort((left, right) => left.id.localeCompare(right.id));
}

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
        ? verification.plan.scenarios.map((entry) => entry?.target?.id || null)
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
      validates: (verification.validates || []).map((item) => item.id)
    })),
    scenarios: [...scenarioMap.values()]
  };
}

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

function apiProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter((projection) => (projection.http || []).length > 0);
}

function uiWebProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter(
    (projection) => projection.platform === "ui_web" && (projection.uiRoutes || []).length > 0
  );
}

const WEB_UI_FAMILY_PREFIX = "proj_ui_web__";
const NATIVE_UI_FAMILY_PREFIX = "proj_ui_native__";

/** Prefer canonical ids when multiple shipped web stacks exist (deterministic, not lexicographic). */
const DEFAULT_WEB_UI_STACK_ORDER = ["proj_ui_web__sveltekit", "proj_ui_web__react"];

const DEFAULT_NATIVE_UI_PLATFORM_ORDER = ["proj_ui_native__ios"];

function uiIosProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter(
    (projection) => projection.platform === "ui_ios" && (projection.uiRoutes || []).length > 0
  );
}

/** Prefer canonical native projections (`proj_ui_native__{platform}`); otherwise first routed ui_ios projection. */
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
 * Prefer canonical shipped web projections (`proj_ui_web__{stack}`); otherwise first routed ui_web projection.
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
  const legacySvelteKitProjection = candidates.find((projection) => projection.id === "proj_ui_web");
  if (legacySvelteKitProjection) {
    return legacySvelteKitProjection;
  }
  return candidates[0];
}

export function getDefaultEnvironmentProjections(graph, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const apiProjection = topology.primaryApi?.projection ||
    (options.projectionId ? getProjection(graph, options.projectionId) : null) ||
    apiProjectionCandidates(graph).find((projection) => projection.id === "proj_api") ||
    apiProjectionCandidates(graph)[0];
  const uiProjection = topology.primaryWeb?.projection || pickDefaultUiWebProjection(graph);
  const dbProjection = topology.primaryDb?.projection || getDefaultBackendDbProjection(graph, options);

  if (!apiProjection) {
    throw new Error("Environment generation requires at least one API projection");
  }
  if (!uiProjection) {
    throw new Error("Environment generation requires at least one ui_web projection");
  }
  if (!dbProjection) {
    throw new Error("Environment generation requires at least one DB projection");
  }

  return { apiProjection, uiProjection, dbProjection };
}

export function generateServerBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const component = options.component || topology.apiComponents.find((entry) => entry.projection.id === projectionId);
  const profile = generatorProfile(component?.generator?.id, "hono");
  const dbProjectionId = component?.databaseComponent?.projection?.id || options.dbProjectionId;
  const generatorOptions = { ...options, projectionId, dbProjectionId, component };
  return profile === "express"
    ? generateExpressServer(graph, generatorOptions)
    : generateHonoServer(graph, generatorOptions);
}

export function generateWebBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const component = options.component || topology.webComponents.find((entry) => entry.projection.id === projectionId);
  return generateWebApp(graph, { ...options, projectionId, component });
}

export function generateDbBundle(graph, projectionId, options = {}) {
  const topology = resolveRuntimeTopology(graph, options);
  const component = options.component || topology.dbComponents.find((entry) => entry.projection.id === projectionId);
  return generateDbLifecycleBundleForProjection(graph, getProjection(graph, projectionId), { ...options, component });
}

export function generateRuntimeApiContracts(graph) {
  return generateApiContractGraph(graph, {});
}

function envVarPrefix(componentId, options = {}) {
  return options.primary || componentId === "db"
    ? ""
    : `${componentId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_`;
}

export function dbEnvVarsForComponent(component, options = {}) {
  const prefix = envVarPrefix(component.id, options);
  return {
    databaseUrl: component.env?.databaseUrl || `${prefix}DATABASE_URL`,
    databaseAdminUrl: component.env?.databaseAdminUrl || `${prefix}DATABASE_ADMIN_URL`,
    dbPort: component.env?.dbPort || `${prefix}DB_PORT`,
    postgresDb: component.env?.postgresDb || `${prefix}POSTGRES_DB`
  };
}

function decorateComponents(graph, config) {
  const byProjectionId = new Map((graph.byKind.projection || []).map((projection) => [projection.id, projection]));
  const rawComponents = config.topology?.components || [];
  const components = rawComponents.map((component) => ({
    ...component,
    projection: byProjectionId.get(component.projection)
  }));
  const byId = new Map(components.map((component) => [component.id, component]));
  for (const component of components) {
    if (component.type === "api" && component.database) {
      component.databaseComponent = byId.get(component.database) || null;
    }
    if (component.type === "web" && component.api) {
      component.apiComponent = byId.get(component.api) || null;
    }
  }
  return components;
}

export function resolveRuntimeTopology(graph, options = {}) {
  const config = options.projectConfig || defaultProjectConfigForGraph(graph, options.implementation || null);
  const validation = validateProjectConfig(config, graph);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
  const components = decorateComponents(graph, config);
  const apiComponents = components.filter((component) => component.type === "api");
  const webComponents = components.filter((component) => component.type === "web");
  const dbComponents = components.filter((component) => component.type === "database");
  const primaryApi = apiComponents[0] || null;
  const primaryWeb = webComponents[0] || null;
  const primaryDb = primaryApi?.databaseComponent || dbComponents[0] || null;

  return {
    config,
    components,
    apiComponents,
    webComponents,
    dbComponents,
    primaryApi,
    primaryWeb,
    primaryDb,
    serviceDir(component) {
      return `services/${component.id}`;
    },
    webDir(component) {
      return `web/${component.id}`;
    },
    dbDir(component) {
      return `db/${component.id}`;
    }
  };
}

export function runtimePorts(runtimeReference, topology = null) {
  return {
    server: topology?.primaryApi?.port || runtimeReference?.ports?.server || 3000,
    web: topology?.primaryWeb?.port || runtimeReference?.ports?.web || 5173
  };
}

export function runtimeUrls(runtimeReference, topology = null) {
  const ports = runtimePorts(runtimeReference, topology);
  return {
    api: `http://localhost:${ports.server}`,
    web: `http://localhost:${ports.web}`
  };
}
