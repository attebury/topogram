// @ts-check

import fs from "node:fs";

import { generateWorkspace } from "../../../../generator.js";
import { parsePath } from "../../../../parser.js";
import {
  adoptionPlanPath,
  buildMaintainedBundle,
  buildSlice,
  normalizeTopogramPath,
  printValidationFailure,
  readJson,
  resultOk,
  selectorOptions
} from "../workspace.js";
import { printJson } from "./output.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @returns {number|null}
 */
export function runArtifactQuery(context) {
  const queryName = context.commandArgs?.queryName;
  const selectors = selectorOptions(context);
  const selectedWidgetId = context["componentId"];

  if (queryName === "task-mode") {
    const result = generateWorkspace(parsePath(context.inputPath), {
      target: "context-task-mode",
      modeId: context.modeId,
      ...selectors,
      widgetId: selectedWidgetId,
      fromTopogramPath: context.fromTopogramPath
    });
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(result.artifact);
  }

  if (queryName === "diff") {
    const result = generateWorkspace(parsePath(context.inputPath), {
      target: "context-diff",
      fromTopogramPath: context.fromTopogramPath
    });
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(result.artifact);
  }

  if (queryName === "slice") {
    const result = buildSlice(parsePath(context.inputPath), selectors);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(result.artifact);
  }

  if (queryName === "adoption-plan") {
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const planPath = adoptionPlanPath(topogramRoot);
    if (!fs.existsSync(planPath)) {
      throw new Error(`No agent adoption plan found at '${planPath}'`);
    }
    return printJson(readJson(planPath));
  }

  if (queryName === "maintained-boundary") {
    const result = buildMaintainedBundle(parsePath(context.inputPath));
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(result.artifact.maintained_boundary);
  }

  if (queryName === "domain-list") {
    const result = generateWorkspace(parsePath(context.inputPath), { target: "domain-list" });
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(result.artifact);
  }

  if (queryName === "domain-coverage") {
    if (!context.domainId) {
      console.error("query domain-coverage requires --domain <id>");
      return 2;
    }
    const result = generateWorkspace(parsePath(context.inputPath), { target: "domain-coverage", domainId: context.domainId });
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(result.artifact);
  }

  if (queryName === "widget-behavior") {
    const result = generateWorkspace(parsePath(normalizeTopogramPath(context.inputPath)), {
      target: "widget-behavior-report",
      projectionId: context.projectionId,
      componentId: selectedWidgetId
    });
    if (!resultOk(result)) return printValidationFailure(result);
    printJson(result.artifact);
    return (result.artifact.summary?.errors || 0) === 0 ? 0 : 1;
  }

  return null;
}
