// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  implementationOutsideRootMessage,
  TEMPLATE_TRUST_FILE,
  TEMPLATE_TRUST_POLICY
} from "./constants.js";
import { hashImplementationContent } from "./content.js";
import {
  implementationModuleIsUnderRoot,
  implementationTrustFingerprint
} from "./policy.js";

/**
 * @typedef {Object} TemplateTrustRecord
 * @property {string} version
 * @property {string} trustPolicy
 * @property {string} trustedAt
 * @property {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, catalog?: Record<string, any>|null }} template
 * @property {{ id: string|null, module: string, export: string }} implementation
 * @property {{ algorithm: "sha256", root: string, digest: string, files: Array<{ path: string, sha256: string, size: number }> }} content
 */

/**
 * @param {string} configDir
 * @returns {TemplateTrustRecord|null}
 */
export function readTemplateTrustRecord(configDir) {
  const trustPath = path.join(configDir, TEMPLATE_TRUST_FILE);
  if (!fs.existsSync(trustPath)) {
    return null;
  }
  return /** @type {TemplateTrustRecord} */ (JSON.parse(fs.readFileSync(trustPath, "utf8")));
}

/**
 * @param {string} configDir
 * @param {Record<string, any>} projectConfig
 * @param {{ id: string|null, module: string, export: string }} implementation
 * @returns {TemplateTrustRecord}
 */
function buildTrustRecord(configDir, projectConfig, implementation) {
  const template = projectConfig.template || {};
  const content = hashImplementationContent(configDir);
  return {
    version: "1",
    trustPolicy: TEMPLATE_TRUST_POLICY,
    trustedAt: new Date().toISOString(),
    template: {
      id: typeof template.id === "string" ? template.id : null,
      version: typeof template.version === "string" ? template.version : null,
      source: typeof template.source === "string" ? template.source : null,
      sourceSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null,
      requested: typeof template.requested === "string" ? template.requested : null,
      sourceRoot: typeof template.sourceRoot === "string" ? template.sourceRoot : null,
      catalog: template.catalog && typeof template.catalog === "object" && !Array.isArray(template.catalog)
        ? template.catalog
        : null
    },
    implementation,
    content
  };
}

/**
 * @param {string} configDir
 * @param {Record<string, any>} projectConfig
 * @returns {TemplateTrustRecord}
 */
export function writeTemplateTrustRecord(configDir, projectConfig) {
  const implementationConfig = projectConfig.implementation;
  if (!implementationConfig) {
    throw new Error("Cannot trust template implementation because topogram.project.json has no implementation config.");
  }
  const implementationInfo = {
    config: implementationConfig,
    configDir
  };
  if (!implementationModuleIsUnderRoot(implementationInfo)) {
    const implementation = implementationTrustFingerprint(implementationConfig);
    throw new Error(implementationOutsideRootMessage(implementation.module));
  }
  const implementation = implementationTrustFingerprint(implementationConfig);
  const record = buildTrustRecord(configDir, projectConfig, implementation);
  fs.writeFileSync(path.join(configDir, TEMPLATE_TRUST_FILE), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}
