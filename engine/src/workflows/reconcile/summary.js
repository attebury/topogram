// @ts-check
import {
  buildAuthHintClosureSummary,
  inferBundleAuthClaimHints,
  inferBundleAuthOwnershipHints,
  inferBundleAuthPermissionHints,
  inferBundleAuthRoleGuidance
} from "./auth.js";
import { primaryEntityIdForBundle } from "./bundle-shared.js";

/** @param {CandidateBundle} bundle @returns {any} */
export function summarizeBundleParticipants(bundle) {
  const actors = [...new Set((bundle.actors || []).map((/** @type {any} */ entry) => entry.id_hint))];
  const roles = [...new Set((bundle.roles || []).map((/** @type {any} */ entry) => entry.id_hint))];
  return {
    actors,
    roles,
    label: [...actors, ...roles].length
      ? [...actors, ...roles].map((/** @type {any} */ item) => `\`${item}\``).join(", ")
      : "_none_"
  };
}

/** @param {CandidateBundle} bundle @param {any[]} values @param {string} empty @returns {any} */
export function summarizeBundleSurface(bundle, values, empty = "_none_") {
  const list = Array.isArray(values) ? values : [];
  return list.length ? list.map((/** @type {any} */ item) => `\`${item}\``).join(", ") : empty;
}

/** @param {CandidateBundle} bundle @returns {any} */
export function buildBundleOperatorSummary(bundle) {
  const primaryEntityId = primaryEntityIdForBundle(bundle);
  const primaryConcept =
    primaryEntityId ||
    bundle.capabilities?.[0]?.id_hint ||
    bundle.cliSurfaces?.[0]?.id_hint ||
    bundle.workflows?.[0]?.id_hint ||
    bundle.screens?.[0]?.id_hint ||
    bundle.enums?.[0]?.id_hint ||
    bundle.id;
  const participants = summarizeBundleParticipants(bundle);
  const capabilityIds = [...new Set((bundle.capabilities || []).map((/** @type {any} */ entry) => entry.id_hint))].slice(0, 4);
  const widgetIds = [...new Set((bundle.widgets || []).map((/** @type {any} */ entry) => entry.id_hint))].slice(0, 4);
  const cliSurfaceIds = [...new Set((bundle.cliSurfaces || []).map((/** @type {any} */ entry) => entry.id_hint))].slice(0, 4);
  const screenIds = [...new Set((bundle.screens || []).map((/** @type {any} */ entry) => entry.id_hint))].slice(0, 4);
  const routePaths = [...new Set((bundle.uiRoutes || []).map((/** @type {any} */ entry) => entry.path).filter(Boolean))].slice(0, 4);
  const workflowIds = [...new Set((bundle.workflows || []).map((/** @type {any} */ entry) => entry.id_hint))].slice(0, 4);
  const authPermissionHints = bundle.authPermissionHints || inferBundleAuthPermissionHints(bundle);
  const authClaimHints = bundle.authClaimHints || inferBundleAuthClaimHints(bundle);
  const authOwnershipHints = bundle.authOwnershipHints || inferBundleAuthOwnershipHints(bundle);
  const authRoleGuidance = bundle.authRoleGuidance || inferBundleAuthRoleGuidance({
    ...bundle,
    authPermissionHints,
    authClaimHints,
    authOwnershipHints
  });
  const evidenceKinds = [
    (bundle.entities || []).length > 0 ? "entity evidence" : null,
    (bundle.capabilities || []).length > 0 ? "API capability evidence" : null,
    (bundle.cliSurfaces || []).length > 0 ? "CLI surface evidence" : null,
    (bundle.widgets || []).length > 0 ? "UI widget evidence" : null,
    (bundle.screens || []).length > 0 || (bundle.uiRoutes || []).length > 0 ? "UI screen/route evidence" : null,
    (bundle.workflows || []).length > 0 ? "workflow evidence" : null,
    (bundle.docs || []).length > 0 ? "doc evidence" : null,
    (bundle.actors || []).length > 0 || (bundle.roles || []).length > 0 ? "actor/role evidence" : null
  ].filter(Boolean);
  const whyThisBundle =
    evidenceKinds.length > 0
      ? `This bundle exists because ${evidenceKinds.join(", ")} converges on the same ${bundle.label.toLowerCase()} concept.`
      : `This bundle exists because multiple imported signals point at the same ${bundle.label.toLowerCase()} concept.`;

  return {
    primaryConcept,
    primaryEntityId,
    participants,
    capabilityIds,
    widgetIds,
    cliSurfaceIds,
    screenIds,
    routePaths,
    workflowIds,
    authPermissionHints,
    authClaimHints,
    authOwnershipHints,
    authRoleGuidance,
    authAging: bundle.operatorSummary?.authAging || null,
    authClosureSummary: buildAuthHintClosureSummary({
      authPermissionHints,
      authClaimHints,
      authOwnershipHints
    }),
    whyThisBundle
  };
}
