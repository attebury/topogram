// @ts-check

import { commandPath } from "./shared.js";

const QUERY_NAMES = new Set([
  "task-mode",
  "diff",
  "slice",
  "adoption-plan",
  "maintained-boundary",
  "maintained-conformance",
  "maintained-drift",
  "seam-check",
  "domain-coverage",
  "domain-list",
  "review-boundary",
  "write-scope",
  "verification-targets",
  "widget-behavior",
  "change-plan",
  "extract-plan",
  "risk-summary",
  "canonical-writes",
  "proceed-decision",
  "review-packet",
  "next-action",
  "single-agent-plan",
  "multi-agent-plan",
  "resolved-workflow-context",
  "workflow-preset-activation",
  "workflow-preset-diff",
  "workflow-preset-customization",
  "work-packet",
  "lane-status",
  "handoff-status",
  "auth-hints",
  "auth-review-packet",
  "sdlc-available",
  "sdlc-claimed",
  "sdlc-blockers",
  "sdlc-proof-gaps"
]);

/**
 * @param {string[]} args
 * @returns {import("./shared.js").SplitCommandArgs|null}
 */
export function parseCoreCommandArgs(args) {
  if (args[0] === "copy") {
    if (args.includes("--list")) {
      return { copyCommand: "list", inputPath: null };
    }
    return { copyCommand: "copy", copySource: args[1], inputPath: args[2] };
  }
  if (args[0] === "init") {
    return { initProject: true, inputPath: commandPath(args, 1, ".") };
  }
  if (args[0] === "generate" && args[1] === "app") {
    return { generateTarget: "app-bundle", write: true, inputPath: commandPath(args, 2), defaultOutDir: "./app" };
  }
  if (args[0] === "generate" && args[1] === "journeys") {
    return { workflowName: "generate-journeys", inputPath: args[2] };
  }
  if (args[0] === "generate" && args[1] !== "journeys") {
    return { generateTarget: "app-bundle", write: true, inputPath: commandPath(args, 1), defaultOutDir: "./app" };
  }
  if (args[0] === "emit") {
    if (!args[1] || args[1].startsWith("-")) {
      return { emitHelp: true, inputPath: null };
    }
    return { generateTarget: args[1], inputPath: commandPath(args, 2), emitArtifact: true };
  }
  if (args[0] === "version" || args[0] === "--version") {
    return { version: true, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "list") {
    return { queryList: true, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "show") {
    return { queryShow: true, queryShowName: args[2] || null, inputPath: null };
  }
  if (args[0] === "query" && args[1] === "workflow-preset" && args[2] === "customize") {
    return { workflowPresetCommand: "customize", inputPath: commandPath(args, 3) };
  }
  if (args[0] === "workflow-preset" && args[1] === "customize") {
    return { workflowPresetCommand: "customize", inputPath: commandPath(args, 2) };
  }
  if (args[0] === "query" && QUERY_NAMES.has(args[1])) {
    return { queryName: args[1], inputPath: commandPath(args, 2) };
  }
  if (args[0] === "doctor") {
    return { doctor: true, inputPath: args[1] && !args[1].startsWith("-") ? args[1] : null };
  }
  if (args[0] === "check") {
    return { check: true, inputPath: commandPath(args, 1) };
  }
  if (args[0] === "validate") {
    return { validate: true, inputPath: args[1] };
  }
  if (args[0] === "agent" && args[1] === "brief") {
    return { agentBrief: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "widget" && args[1] === "check") {
    return { widgetCheck: true, inputPath: commandPath(args, 2) };
  }
  if (args[0] === "widget" && args[1] === "behavior") {
    return { widgetBehavior: true, inputPath: commandPath(args, 2) };
  }
  return null;
}
