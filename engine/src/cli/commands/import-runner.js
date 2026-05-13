// @ts-check

import { stableStringify } from "../../format.js";
import {
  buildBrownfieldImportAdoptListPayload,
  buildBrownfieldImportAdoptPayload,
  buildBrownfieldImportCheckPayload,
  buildBrownfieldImportDiffPayload,
  buildBrownfieldImportHistoryPayload,
  buildBrownfieldImportPlanPayload,
  buildBrownfieldImportRefreshPayload,
  buildBrownfieldImportStatusPayload,
  buildBrownfieldImportWorkspacePayload,
  printAdoptHelp,
  printBrownfieldImportAdopt,
  printBrownfieldImportAdoptList,
  printBrownfieldImportCheck,
  printBrownfieldImportDiff,
  printBrownfieldImportHistory,
  printBrownfieldImportPlan,
  printBrownfieldImportRefresh,
  printBrownfieldImportStatus,
  printBrownfieldImportWorkspace,
  printExtractHelp
} from "./import.js";

/**
 * @param {{ commandArgs: Record<string, any>, inputPath: string|null|undefined, outPath?: string|null, fromValue?: string|null, extractorSpecs?: string[], extractorPolicyPath?: string|null, reasonValue?: string|null, refreshAdopted?: boolean, dryRun?: boolean, write?: boolean, force?: boolean, json?: boolean }} context
 * @returns {number}
 */
export function runImportCommand(context) {
  const {
    commandArgs,
    inputPath,
    outPath = null,
    fromValue = null,
    extractorSpecs = [],
    extractorPolicyPath = null,
    reasonValue = null,
    refreshAdopted = false,
    dryRun = false,
    write = false,
    force = false,
    json = false
  } = context;
  const command = commandArgs.importCommand;

  if (command === "workspace") {
    if (!outPath) {
      console.error("Missing required --out <target>.");
      printExtractHelp();
      return 1;
    }
    const payload = buildBrownfieldImportWorkspacePayload(inputPath || "", outPath, { from: fromValue, extractorSpecs, extractorPolicyPath, cwd: process.cwd() });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportWorkspace(payload);
    }
    return 0;
  }

  if (command === "diff") {
    const payload = buildBrownfieldImportDiffPayload(inputPath || ".", { sourcePath: fromValue });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportDiff(payload);
    }
    return 0;
  }

  if (command === "refresh") {
    const payload = buildBrownfieldImportRefreshPayload(inputPath || ".", { sourcePath: fromValue, dryRun });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportRefresh(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "check") {
    const payload = buildBrownfieldImportCheckPayload(inputPath || ".");
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportCheck(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "plan") {
    const payload = buildBrownfieldImportPlanPayload(inputPath || ".");
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportPlan(payload);
    }
    return 0;
  }

  if (command === "adopt-list") {
    const payload = buildBrownfieldImportAdoptListPayload(inputPath || ".");
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportAdoptList(payload);
    }
    return 0;
  }

  if (command === "adopt") {
    if (!commandArgs.importAdoptSelector || commandArgs.importAdoptSelector.startsWith("-")) {
      console.error("Missing required <selector>.");
      printAdoptHelp();
      return 1;
    }
    if (write && dryRun) {
      console.error("Use either --dry-run or --write, not both.");
      printAdoptHelp();
      return 1;
    }
    const payload = buildBrownfieldImportAdoptPayload(commandArgs.importAdoptSelector, inputPath || ".", {
      dryRun,
      write,
      force,
      reason: reasonValue,
      refreshAdopted
    });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportAdopt(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "status") {
    const payload = buildBrownfieldImportStatusPayload(inputPath || ".");
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportStatus(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (command === "history") {
    const payload = buildBrownfieldImportHistoryPayload(inputPath || ".", { verify: commandArgs.verify });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportHistory(payload);
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown extract/adopt command '${command}'`);
}
