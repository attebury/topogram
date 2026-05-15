// @ts-check

import path from "node:path";

import { loadProjectConfig } from "../../project-config.js";
import { sanitizePublicPayload, stablePublicStringify } from "../../public-paths.js";
import { writeTemplatePolicyForProject } from "../../new-project.js";
import {
  buildTemplateCheckPayload,
  buildTemplateDetachPayload,
  buildTemplateExplainPayload,
  buildTemplateListPayload,
  buildTemplatePolicyCheckPayload,
  buildTemplatePolicyExplainPayload,
  buildTemplatePolicyPinPayload,
  buildTemplateShowPayload,
  buildTemplateStatusPayload,
  buildTemplateUpdateCliPayload,
  printTemplateCheckPayload,
  printTemplateDetachPayload,
  printTemplateExplain,
  printTemplateHelp,
  printTemplateList,
  printTemplatePolicyCheckPayload,
  printTemplatePolicyExplainPayload,
  printTemplatePolicyPinPayload,
  printTemplateShow,
  printTemplateStatus,
  printTemplateUpdatePlan,
  printTemplateUpdateRecommendation
} from "./template.js";

/**
 * @param {Record<string, any>} [config]
 * @param {string|null|undefined} [projectRoot]
 * @returns {string|null}
 */
function workspaceRootFromConfig(config = {}, projectRoot = null) {
  if (!projectRoot || !config.workspace || typeof config.workspace !== "string") return null;
  return path.resolve(projectRoot, config.workspace);
}

/**
 * @param {any} payload
 * @param {{ projectRoot?: string|null, workspaceRoot?: string|null }} [context]
 * @returns {any}
 */
function publicTemplatePayload(payload, context = {}) {
  return sanitizePublicPayload(payload, {
    projectRoot: context.projectRoot || payload?.projectRoot || process.cwd(),
    workspaceRoot: context.workspaceRoot || payload?.workspaceRoot || payload?.topogramRoot || null,
    cwd: process.cwd()
  });
}

/**
 * @param {any} payload
 * @param {{ projectRoot?: string|null, workspaceRoot?: string|null }} [context]
 * @returns {void}
 */
function printPublicJson(payload, context = {}) {
  console.log(stablePublicStringify(payload, {
    projectRoot: context.projectRoot || payload?.projectRoot || process.cwd(),
    workspaceRoot: context.workspaceRoot || payload?.workspaceRoot || payload?.topogramRoot || null,
    cwd: process.cwd()
  }));
}

/**
 * @param {{ commandArgs: Record<string, any>, inputPath: string|null|undefined, args: string[], catalogSource?: string|null, templateName?: string|null, outPath?: string|null, json?: boolean }} context
 * @returns {number}
 */
export function runTemplateCommand(context) {
  const { commandArgs, inputPath, args, catalogSource = null, templateName = null, outPath = null, json = false } = context;
  const command = commandArgs.templateCommand;
  if (command === "list") {
    const payload = buildTemplateListPayload({ catalogSource });
    if (json) {
      printPublicJson(payload);
    } else {
      printTemplateList(publicTemplatePayload(payload));
    }
    return 0;
  }

  if (command === "show") {
    if (!inputPath) {
      console.error("Missing required <id>.");
      printTemplateHelp();
      return 1;
    }
    const payload = buildTemplateShowPayload(inputPath, catalogSource);
    if (json) {
      printPublicJson(payload);
    } else {
      printTemplateShow(publicTemplatePayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "explain") {
    const projectConfigInfo = loadProjectConfig(inputPath || ".");
    if (!projectConfigInfo) {
      throw new Error("Cannot explain template lifecycle without topogram.project.json.");
    }
    const payload = buildTemplateExplainPayload(projectConfigInfo);
    const publicContext = {
      projectRoot: projectConfigInfo.configDir,
      workspaceRoot: workspaceRootFromConfig(projectConfigInfo.config, projectConfigInfo.configDir)
    };
    if (json) {
      printPublicJson(payload, publicContext);
    } else {
      printTemplateExplain(publicTemplatePayload(payload, publicContext));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "status") {
    const projectConfigInfo = loadProjectConfig(inputPath || "./topo");
    if (!projectConfigInfo) {
      throw new Error("Cannot inspect template status without topogram.project.json.");
    }
    const payload = buildTemplateStatusPayload(projectConfigInfo, { latest: args.includes("--latest") });
    const publicContext = {
      projectRoot: projectConfigInfo.configDir,
      workspaceRoot: workspaceRootFromConfig(projectConfigInfo.config, projectConfigInfo.configDir)
    };
    if (json) {
      printPublicJson(payload, publicContext);
    } else {
      printTemplateStatus(publicTemplatePayload(payload, publicContext));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "detach") {
    const projectConfigInfo = loadProjectConfig(inputPath || ".");
    if (!projectConfigInfo) {
      throw new Error("Cannot detach template metadata without topogram.project.json.");
    }
    const payload = buildTemplateDetachPayload(projectConfigInfo, {
      dryRun: args.includes("--dry-run"),
      removePolicy: args.includes("--remove-policy")
    });
    const publicContext = {
      projectRoot: projectConfigInfo.configDir,
      workspaceRoot: workspaceRootFromConfig(projectConfigInfo.config, projectConfigInfo.configDir)
    };
    if (json) {
      printPublicJson(payload, publicContext);
    } else {
      printTemplateDetachPayload(publicTemplatePayload(payload, publicContext));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "policy:init") {
    const projectConfigInfo = loadProjectConfig(inputPath || "./topo");
    if (!projectConfigInfo) {
      throw new Error("Cannot initialize template policy without topogram.project.json.");
    }
    const policy = writeTemplatePolicyForProject(projectConfigInfo.configDir, projectConfigInfo.config);
    const payload = {
      ok: true,
      path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
      policy,
      diagnostics: [],
      errors: []
    };
    const publicContext = {
      projectRoot: projectConfigInfo.configDir,
      workspaceRoot: workspaceRootFromConfig(projectConfigInfo.config, projectConfigInfo.configDir)
    };
    if (json) {
      printPublicJson(payload, publicContext);
    } else {
      const publicPayload = publicTemplatePayload(payload, publicContext);
      console.log(`Wrote template policy: ${publicPayload.path}`);
      console.log(`Allowed template ids: ${policy.allowedTemplateIds.join(", ") || "(any)"}`);
      console.log(`Allowed sources: ${policy.allowedSources.join(", ") || "(any)"}`);
    }
    return 0;
  }

  if (command === "policy:check") {
    const payload = buildTemplatePolicyCheckPayload(inputPath || "./topo");
    if (json) {
      printPublicJson(payload);
    } else {
      printTemplatePolicyCheckPayload(publicTemplatePayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "policy:explain") {
    const payload = buildTemplatePolicyExplainPayload(inputPath || "./topo");
    if (json) {
      printPublicJson(payload);
    } else {
      printTemplatePolicyExplainPayload(publicTemplatePayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "policy:pin") {
    const payload = buildTemplatePolicyPinPayload(inputPath || "./topo", commandArgs.templatePolicyPinSpec);
    if (json) {
      printPublicJson(payload);
    } else {
      printTemplatePolicyPinPayload(publicTemplatePayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "check") {
    if (!inputPath) {
      console.error("Missing required <template-spec-or-path>.");
      printTemplateHelp();
      return 1;
    }
    const payload = buildTemplateCheckPayload(inputPath);
    if (json) {
      printPublicJson(payload);
    } else {
      printTemplateCheckPayload(publicTemplatePayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "update") {
    const payload = buildTemplateUpdateCliPayload({
      args,
      inputPath: inputPath || "./topo",
      templateIndex: args.indexOf("--template"),
      templateName,
      useLatestTemplate: args.includes("--latest"),
      outPath
    });
    if (json) {
      printPublicJson(payload);
    } else if (args.includes("--recommend")) {
      printTemplateUpdateRecommendation(publicTemplatePayload(payload));
    } else {
      printTemplateUpdatePlan(publicTemplatePayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown template command '${command}'`);
}
