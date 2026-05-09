// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { loadProjectConfig } from "../../project-config.js";
import {
  getTemplateTrustDiff,
  getTemplateTrustStatus,
  implementationRequiresTrust,
  TEMPLATE_TRUST_FILE,
  templateTrustRecoveryGuidance,
  writeTemplateTrustRecord
} from "../../template-trust.js";
import { writeTemplateFilesManifest } from "../../new-project.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @returns {void}
 */
export function printTrustHelp() {
  console.log("Usage: topogram trust status [path] [--json]");
  console.log("   or: topogram trust diff [path] [--json]");
  console.log("   or: topogram trust template [path] [--force]");
  console.log("");
  console.log("Inspects or refreshes executable template implementation trust after human review.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram trust status");
  console.log("  topogram trust diff");
  console.log("  topogram trust template");
}

/**
 * @param {AnyRecord} projectConfigInfo
 * @returns {{ config: any, configPath: string, configDir: string }}
 */
function implementationInfoFromProject(projectConfigInfo) {
  return {
    config: projectConfigInfo.config.implementation,
    configPath: projectConfigInfo.configPath,
    configDir: projectConfigInfo.configDir
  };
}

/**
 * @param {string} inputPath
 * @param {{ force?: boolean }} [options]
 * @returns {number}
 */
export function runTrustTemplateCommand(inputPath, options = {}) {
  const projectConfigInfo = loadProjectConfig(inputPath);
  if (!projectConfigInfo) {
    throw new Error("Cannot trust template files without topogram.project.json.");
  }
  const templateManifestPath = path.join(projectConfigInfo.configDir, "topogram-template.json");
  if (!projectConfigInfo.config.template && fs.existsSync(templateManifestPath) && !options.force) {
    throw new Error("Cannot write consumer template trust metadata in a template source repo. Template source repos should not contain .topogram-template-files.json or .topogram-template-trust.json. Run this command in a generated project, or pass --force if you intentionally need local trust metadata here.");
  }
  if (!projectConfigInfo.config.template && fs.existsSync(templateManifestPath) && options.force) {
    console.warn("Warning: writing consumer template trust metadata in a template source repo because --force was provided.");
  }
  const fileManifest = writeTemplateFilesManifest(projectConfigInfo.configDir, projectConfigInfo.config);
  console.log(`Wrote .topogram-template-files.json with ${fileManifest.files.length} template-owned file hash(es).`);
  if (projectConfigInfo.config.implementation) {
    const implementationInfo = implementationInfoFromProject(projectConfigInfo);
    if (implementationRequiresTrust(implementationInfo, projectConfigInfo.config)) {
      const trustRecord = writeTemplateTrustRecord(projectConfigInfo.configDir, projectConfigInfo.config);
      console.log(`Wrote ${TEMPLATE_TRUST_FILE} for ${trustRecord.implementation.module}.`);
      if (trustRecord.template.id) {
        console.log(`Trusted template: ${trustRecord.template.id}@${trustRecord.template.version || "unknown"}`);
      }
      console.log(`Trusted implementation digest: ${trustRecord.content.digest}`);
      return 0;
    }
  }
  console.log("No local implementation trust record needed for this project.");
  return 0;
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean }} [options]
 * @returns {number}
 */
export function runTrustStatusCommand(inputPath, options = {}) {
  const projectConfigInfo = loadProjectConfig(inputPath);
  if (!projectConfigInfo) {
    throw new Error("Cannot inspect template trust without topogram.project.json.");
  }
  if (!projectConfigInfo.config.implementation) {
    throw new Error("Cannot inspect template trust because topogram.project.json has no implementation config.");
  }
  const status = getTemplateTrustStatus(implementationInfoFromProject(projectConfigInfo), projectConfigInfo.config);
  if (options.json) {
    console.log(stableStringify(status));
  } else if (!status.requiresTrust) {
    console.log("No local implementation trust record needed for this project.");
  } else {
    console.log(status.ok ? "Implementation trust status: trusted" : "Implementation trust status: review required");
    if (status.template.id) {
      console.log(`Template: ${status.template.id}@${status.template.version || "unknown"}`);
    }
    console.log(`Implementation: ${status.implementation.module}`);
    if (status.content.trustedDigest) {
      console.log(`Trusted digest: ${status.content.trustedDigest}`);
    }
    if (status.content.currentDigest) {
      console.log(`Current digest: ${status.content.currentDigest}`);
    }
    for (const issue of status.issues) {
      console.log(`Issue: ${issue}`);
    }
    for (const filePath of status.content.changed) {
      console.log(`Changed: ${filePath}`);
    }
    for (const filePath of status.content.added) {
      console.log(`Added: ${filePath}`);
    }
    for (const filePath of status.content.removed) {
      console.log(`Removed: ${filePath}`);
    }
    if (!status.ok) {
      const guidance = templateTrustRecoveryGuidance(status.issues);
      if (guidance) {
        console.log(guidance);
      }
    }
  }
  return status.ok ? 0 : 1;
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean }} [options]
 * @returns {number}
 */
export function runTrustDiffCommand(inputPath, options = {}) {
  const projectConfigInfo = loadProjectConfig(inputPath);
  if (!projectConfigInfo) {
    throw new Error("Cannot inspect template trust diff without topogram.project.json.");
  }
  if (!projectConfigInfo.config.implementation) {
    throw new Error("Cannot inspect template trust diff because topogram.project.json has no implementation config.");
  }
  const diff = getTemplateTrustDiff(implementationInfoFromProject(projectConfigInfo), projectConfigInfo.config);
  if (options.json) {
    console.log(stableStringify(diff));
  } else if (!diff.requiresTrust) {
    console.log("No local implementation trust record needed for this project.");
  } else if (diff.files.length === 0) {
    console.log(diff.ok ? "Template trust diff: no implementation changes." : "Template trust diff: no file-level diff available.");
    for (const issue of diff.status.issues) {
      console.log(`Issue: ${issue}`);
    }
    if (!diff.ok) {
      const guidance = templateTrustRecoveryGuidance(diff.status.issues);
      if (guidance) {
        console.log(guidance);
      }
    }
  } else {
    console.log(diff.ok ? "Template trust diff: no implementation changes." : "Template trust diff: review required");
    for (const file of diff.files) {
      console.log("");
      console.log(`${file.kind.toUpperCase()}: implementation/${file.path}`);
      if (file.trusted) {
        console.log(`  trusted sha256: ${file.trusted.sha256}`);
        console.log(`  trusted size: ${file.trusted.size}`);
      }
      if (file.current) {
        console.log(`  current sha256: ${file.current.sha256}`);
        console.log(`  current size: ${file.current.size}`);
      }
      if (file.binary) {
        console.log("  diff: binary file");
      } else if (file.diffOmitted && !file.unifiedDiff) {
        console.log("  diff: hash-only");
      }
      if (file.unifiedDiff) {
        console.log(file.unifiedDiff.trimEnd());
      }
    }
    if (!diff.ok) {
      console.log("");
      const guidance = templateTrustRecoveryGuidance(diff.status.issues);
      if (guidance) {
        console.log(guidance);
      }
    }
  }
  return diff.ok ? 0 : 1;
}

/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   json: boolean
 * }} context
 * @returns {number}
 */
export function runTrustCommand(context) {
  const inputPath = context.inputPath || "./topogram";
  if (context.commandArgs.trustCommand === "template") {
    return runTrustTemplateCommand(inputPath, { force: Boolean(context.commandArgs.force) });
  }
  if (context.commandArgs.trustCommand === "status") {
    return runTrustStatusCommand(inputPath, { json: context.json });
  }
  if (context.commandArgs.trustCommand === "diff") {
    return runTrustDiffCommand(inputPath, { json: context.json });
  }
  throw new Error(`Unknown trust command '${context.commandArgs.trustCommand}'`);
}
