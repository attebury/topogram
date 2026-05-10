// @ts-check

import path from "node:path";

import { stableStringify } from "../../format.js";
import { loadProjectConfig } from "../../project-config.js";
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
 * @param {{ commandArgs: Record<string, any>, inputPath: string|null|undefined, args: string[], catalogSource?: string|null, templateName?: string|null, outPath?: string|null, json?: boolean }} context
 * @returns {number}
 */
export function runTemplateCommand(context) {
  const { commandArgs, inputPath, args, catalogSource = null, templateName = null, outPath = null, json = false } = context;
  const command = commandArgs.templateCommand;
  if (command === "list") {
    const payload = buildTemplateListPayload({ catalogSource });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplateList(payload);
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
      console.log(stableStringify(payload));
    } else {
      printTemplateShow(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "explain") {
    const projectConfigInfo = loadProjectConfig(inputPath || ".");
    if (!projectConfigInfo) {
      throw new Error("Cannot explain template lifecycle without topogram.project.json.");
    }
    const payload = buildTemplateExplainPayload(projectConfigInfo);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplateExplain(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "status") {
    const projectConfigInfo = loadProjectConfig(inputPath || "./topo");
    if (!projectConfigInfo) {
      throw new Error("Cannot inspect template status without topogram.project.json.");
    }
    const payload = buildTemplateStatusPayload(projectConfigInfo, { latest: args.includes("--latest") });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplateStatus(payload);
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
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplateDetachPayload(payload);
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
    if (json) {
      console.log(stableStringify(payload));
    } else {
      console.log(`Wrote template policy: ${payload.path}`);
      console.log(`Allowed template ids: ${policy.allowedTemplateIds.join(", ") || "(any)"}`);
      console.log(`Allowed sources: ${policy.allowedSources.join(", ") || "(any)"}`);
    }
    return 0;
  }

  if (command === "policy:check") {
    const payload = buildTemplatePolicyCheckPayload(inputPath || "./topo");
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplatePolicyCheckPayload(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "policy:explain") {
    const payload = buildTemplatePolicyExplainPayload(inputPath || "./topo");
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplatePolicyExplainPayload(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "policy:pin") {
    const payload = buildTemplatePolicyPinPayload(inputPath || "./topo", commandArgs.templatePolicyPinSpec);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printTemplatePolicyPinPayload(payload);
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
      console.log(stableStringify(payload));
    } else {
      printTemplateCheckPayload(payload);
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
      console.log(stableStringify(payload));
    } else if (args.includes("--recommend")) {
      printTemplateUpdateRecommendation(payload);
    } else {
      printTemplateUpdatePlan(payload);
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown template command '${command}'`);
}
