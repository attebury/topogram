// @ts-check

import { stableStringify } from "../../../format.js";
import { buildCatalogCheckPayload, printCatalogCheck } from "./check.js";
import { buildCatalogCopyPayload, printCatalogCopy } from "./copy.js";
import { buildCatalogDoctorPayload, printCatalogDoctor } from "./doctor.js";
import { printCatalogHelp } from "./help.js";
import { buildCatalogListPayload, printCatalogList } from "./list.js";
import { buildCatalogShowPayload, printCatalogShow } from "./show.js";

/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   catalogSource: string|null,
 *   requestedVersion: string|null,
 *   json: boolean
 * }} context
 * @returns {number}
 */
export function runCatalogCommand(context) {
  const { commandArgs, inputPath, catalogSource, requestedVersion, json } = context;
  if (commandArgs.catalogCommand === "list") {
    const payload = buildCatalogListPayload(catalogSource || inputPath || null);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogList(payload);
    }
    return 0;
  }

  if (commandArgs.catalogCommand === "show") {
    if (!inputPath) {
      console.error("Missing required <id>.");
      printCatalogHelp();
      return 1;
    }
    const payload = buildCatalogShowPayload(inputPath, catalogSource);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogShow(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.catalogCommand === "doctor") {
    const payload = buildCatalogDoctorPayload(catalogSource || inputPath || null);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogDoctor(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.catalogCommand === "check") {
    if (!inputPath) {
      console.error("Missing required <path-or-url>.");
      printCatalogHelp();
      return 1;
    }
    const payload = buildCatalogCheckPayload(inputPath);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogCheck(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.catalogCommand === "copy") {
    if (!commandArgs.catalogId || !inputPath) {
      console.error("Missing required <id> or <target>.");
      printCatalogHelp();
      return 1;
    }
    const payload = buildCatalogCopyPayload(commandArgs.catalogId, inputPath, {
      source: catalogSource,
      version: requestedVersion
    });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogCopy(payload);
    }
    return 0;
  }

  throw new Error(`Unknown catalog command '${commandArgs.catalogCommand}'`);
}
