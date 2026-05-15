// @ts-check

import { sanitizePublicPayload, stablePublicStringify } from "../../../public-paths.js";
import {
  buildGeneratorPolicyCheckPayload,
  buildGeneratorPolicyExplainPayload,
  buildGeneratorPolicyInitPayload,
  buildGeneratorPolicyPinPayload,
  buildGeneratorPolicyStatusPayload
} from "./payloads.js";
import {
  printGeneratorPolicyCheckPayload,
  printGeneratorPolicyExplainPayload,
  printGeneratorPolicyInitPayload,
  printGeneratorPolicyPinPayload,
  printGeneratorPolicyStatusPayload
} from "./printers.js";

/**
 * @param {any} payload
 * @returns {any}
 */
function publicPolicyPayload(payload) {
  return sanitizePublicPayload(payload, {
    projectRoot: process.cwd(),
    cwd: process.cwd()
  });
}

/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   json: boolean
 * }} context
 * @returns {number}
 */
export function runGeneratorPolicyCommand(context) {
  const { commandArgs, inputPath, json } = context;
  const projectPath = inputPath || "./topo";
  if (commandArgs.generatorPolicyCommand === "init") {
    const payload = buildGeneratorPolicyInitPayload(projectPath);
    if (json) {
      console.log(stablePublicStringify(payload, { projectRoot: projectPath, cwd: process.cwd() }));
    } else {
      printGeneratorPolicyInitPayload(publicPolicyPayload(payload));
    }
    return 0;
  }

  if (commandArgs.generatorPolicyCommand === "status") {
    const payload = buildGeneratorPolicyStatusPayload(projectPath);
    if (json) {
      console.log(stablePublicStringify(payload, { projectRoot: projectPath, cwd: process.cwd() }));
    } else {
      printGeneratorPolicyStatusPayload(publicPolicyPayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorPolicyCommand === "check") {
    const payload = buildGeneratorPolicyCheckPayload(projectPath);
    if (json) {
      console.log(stablePublicStringify(payload, { projectRoot: projectPath, cwd: process.cwd() }));
    } else {
      printGeneratorPolicyCheckPayload(publicPolicyPayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorPolicyCommand === "explain") {
    const payload = buildGeneratorPolicyExplainPayload(projectPath);
    if (json) {
      console.log(stablePublicStringify(payload, { projectRoot: projectPath, cwd: process.cwd() }));
    } else {
      printGeneratorPolicyExplainPayload(publicPolicyPayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorPolicyCommand === "pin") {
    const payload = buildGeneratorPolicyPinPayload(projectPath, commandArgs.generatorPolicyPinSpec);
    if (json) {
      console.log(stablePublicStringify(payload, { projectRoot: projectPath, cwd: process.cwd() }));
    } else {
      printGeneratorPolicyPinPayload(publicPolicyPayload(payload));
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown generator policy command '${commandArgs.generatorPolicyCommand}'`);
}
