// @ts-check

import path from "node:path";

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
export function optionValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || null : null;
}

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
export function optionValueIfPresent(args, flag) {
  const value = optionValue(args, flag);
  return value && !value.startsWith("-") ? value : null;
}

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
function resolvedPathOption(args, flag) {
  const value = optionValue(args, flag);
  return value ? path.resolve(value) : null;
}

/**
 * @param {string[]} args
 * @param {Record<string, any>|null|undefined} commandArgs
 * @returns {Record<string, any>}
 */
export function parseCliOptions(args, commandArgs) {
  const generateTarget = commandArgs?.generateTarget || null;
  const workflowFlagValue = optionValue(args, "--workflow");
  const outDir = optionValue(args, "--out-dir");
  const outPath = optionValue(args, "--out");
  return {
    emitJson: args.includes("--json"),
    shouldForce: Boolean(commandArgs?.force) || args.includes("--force"),
    shouldValidate: Boolean(commandArgs?.validate) || args.includes("--validate"),
    shouldResolve: args.includes("--resolve"),
    generateTarget,
    workflowName: commandArgs?.workflowName || (!generateTarget && workflowFlagValue ? workflowFlagValue : null),
    workflowId: generateTarget ? workflowFlagValue : null,
    fromValue: optionValue(args, "--from"),
    adoptValue: commandArgs?.adoptValue || optionValue(args, "--adopt"),
    reasonValue: optionValueIfPresent(args, "--reason"),
    modeId: optionValue(args, "--mode"),
    profileId: optionValue(args, "--profile"),
    providerId: optionValue(args, "--provider"),
    presetId: optionValue(args, "--preset"),
    templateName: optionValue(args, "--template") || "hello-web",
    catalogSource: optionValueIfPresent(args, "--catalog"),
    requestedVersion: optionValueIfPresent(args, "--version"),
    bundleSlug: optionValue(args, "--bundle"),
    laneId: optionValue(args, "--lane"),
    fromSnapshotPath: resolvedPathOption(args, "--from-snapshot"),
    fromTopogramPath: resolvedPathOption(args, "--from-topogram"),
    shouldWrite: Boolean(commandArgs?.write) || args.includes("--write"),
    refreshAdopted: args.includes("--refresh-adopted"),
    outPath,
    effectiveOutDir: outDir || outPath || commandArgs?.defaultOutDir || null,
    selectors: {
      shapeId: optionValue(args, "--shape"),
      capabilityId: optionValue(args, "--capability"),
      workflowId: generateTarget ? workflowFlagValue : null,
      projectionId: optionValue(args, "--projection"),
      widgetId: optionValue(args, "--widget"),
      componentId: optionValue(args, "--widget"),
      entityId: optionValue(args, "--entity"),
      journeyId: optionValue(args, "--journey"),
      surfaceId: optionValue(args, "--surface"),
      domainId: optionValue(args, "--domain"),
      seamId: optionValue(args, "--seam"),
      taskId: optionValue(args, "--task"),
      planId: optionValue(args, "--plan"),
      pitchId: optionValue(args, "--pitch"),
      requirementId: optionValue(args, "--requirement"),
      acceptanceId: optionValue(args, "--acceptance"),
      bugId: optionValue(args, "--bug"),
      documentId: optionValue(args, "--document"),
      kind: optionValue(args, "--kind"),
      appVersion: optionValue(args, "--app-version"),
      sinceTag: optionValue(args, "--since-tag"),
      includeArchived: args.includes("--include-archived"),
      modeId: optionValue(args, "--mode")
    }
  };
}
