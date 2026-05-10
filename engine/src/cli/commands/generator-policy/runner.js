// @ts-check

import { stableStringify } from "../../../format.js";
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
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyInitPayload(payload);
    }
    return 0;
  }

  if (commandArgs.generatorPolicyCommand === "status") {
    const payload = buildGeneratorPolicyStatusPayload(projectPath);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyStatusPayload(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorPolicyCommand === "check") {
    const payload = buildGeneratorPolicyCheckPayload(projectPath);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyCheckPayload(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorPolicyCommand === "explain") {
    const payload = buildGeneratorPolicyExplainPayload(projectPath);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyExplainPayload(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorPolicyCommand === "pin") {
    const payload = buildGeneratorPolicyPinPayload(projectPath, commandArgs.generatorPolicyPinSpec);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyPinPayload(payload);
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown generator policy command '${commandArgs.generatorPolicyCommand}'`);
}
