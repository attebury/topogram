import { stableStringify } from "../format.js";
import { buildWebRealization } from "../realization/ui/index.js";

function normalizeVisibility(visibility = []) {
  return visibility
    .map((entry) => ({
      capabilityId: entry.capabilityId ?? entry.capability?.id ?? null,
      predicate: entry.predicate ?? null,
      value: entry.value ?? null,
      ownershipField: entry.ownershipField ?? null,
      claimValue: entry.claimValue ?? null
    }))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function normalizeScreen(screen) {
  return {
    id: screen.id,
    route: screen.route ?? null,
    kind: screen.kind ?? null,
    title: screen.title ?? null,
    loadCapabilityId: screen.loadCapability?.id ?? null,
    viewShapeId: screen.viewShape?.id ?? null,
    primaryActionId: screen.actions?.primary?.id ?? null,
    secondaryActionId: screen.actions?.secondary?.id ?? null,
    screenActionIds: (screen.actions?.screen ?? []).map((action) => action.id ?? action.capability?.id).sort(),
    visibility: normalizeVisibility(screen.visibility)
  };
}

export function normalizeScreens(contract) {
  return contract.screens.map(normalizeScreen).sort((left, right) => left.id.localeCompare(right.id));
}

export function buildWebParityEvidence(graph, leftProjectionId, rightProjectionId) {
  const left = buildWebRealization(graph, { projectionId: leftProjectionId });
  const right = buildWebRealization(graph, { projectionId: rightProjectionId });
  const leftScreens = normalizeScreens(left.contract);
  const rightScreens = normalizeScreens(right.contract);

  return {
    leftProjectionId,
    rightProjectionId,
    leftProfile: left.contract.generatorDefaults.profile,
    rightProfile: right.contract.generatorDefaults.profile,
    leftScreens,
    rightScreens,
    semanticParity: stableStringify(leftScreens) === stableStringify(rightScreens)
  };
}
