import { generateHonoServer } from "../apps/backend/hono.js";
import { generateWebApp } from "../apps/web/index.js";
import { generateApiContractGraph } from "../api.js";
import { generateDbLifecycleBundleForProjection } from "../db/lifecycle-shared.js";
import { getProjection } from "../db/shared.js";
import { getDefaultBackendDbProjection } from "../../realization/backend/index.js";

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
  const apiProjection =
    (options.projectionId ? getProjection(graph, options.projectionId) : null) ||
    apiProjectionCandidates(graph).find((projection) => projection.id === "proj_api") ||
    apiProjectionCandidates(graph)[0];
  const uiProjection = pickDefaultUiWebProjection(graph);
  const dbProjection = getDefaultBackendDbProjection(graph, options);

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
  return generateHonoServer(graph, { ...options, projectionId });
}

export function generateWebBundle(graph, projectionId, options = {}) {
  return generateWebApp(graph, { ...options, projectionId });
}

export function generateDbBundle(graph, projectionId, options = {}) {
  return generateDbLifecycleBundleForProjection(graph, getProjection(graph, projectionId), options);
}

export function generateRuntimeApiContracts(graph) {
  return generateApiContractGraph(graph, {});
}

export function runtimePorts(runtimeReference) {
  return {
    server: runtimeReference?.ports?.server || 3000,
    web: runtimeReference?.ports?.web || 5173
  };
}

export function runtimeUrls(runtimeReference) {
  const ports = runtimePorts(runtimeReference);
  return {
    api: `http://localhost:${ports.server}`,
    web: `http://localhost:${ports.web}`
  };
}
