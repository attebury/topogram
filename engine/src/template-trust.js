// @ts-check

import fs from "node:fs";
import path from "node:path";

export const TEMPLATE_TRUST_FILE = ".topogram-template-trust.json";
export const TEMPLATE_TRUST_POLICY = "topogram-template-executable-implementation-v1";

/**
 * @typedef {Object} TemplateTrustRecord
 * @property {string} version
 * @property {string} trustPolicy
 * @property {string} trustedAt
 * @property {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null }} template
 * @property {{ id: string|null, module: string, export: string }} implementation
 */

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function isSameOrInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeRoot(value) {
  return String(value || "").replace(/\\/g, "/");
}

/**
 * @param {Record<string, any>} config
 * @returns {{ id: string|null, module: string, export: string }}
 */
export function implementationTrustFingerprint(config) {
  const implementationModule = config.implementation_module || config.module;
  if (!implementationModule || typeof implementationModule !== "string") {
    throw new Error("Topogram implementation config is missing implementation module.");
  }
  return {
    id: config.implementation_id || config.id || null,
    module: implementationModule,
    export: config.implementation_export || config.export || "default"
  };
}

/**
 * @param {{ config: Record<string, any>, configDir: string }} implementationInfo
 * @returns {boolean}
 */
export function implementationRequiresTrust(implementationInfo) {
  const fingerprint = implementationTrustFingerprint(implementationInfo.config);
  const modulePath = path.resolve(implementationInfo.configDir, fingerprint.module);
  const implementationRoot = path.resolve(implementationInfo.configDir, "implementation");
  return isSameOrInside(implementationRoot, modulePath);
}

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
  return {
    version: "1",
    trustPolicy: TEMPLATE_TRUST_POLICY,
    trustedAt: new Date().toISOString(),
    template: {
      id: typeof template.id === "string" ? template.id : null,
      version: typeof template.version === "string" ? template.version : null,
      source: typeof template.source === "string" ? template.source : null,
      sourceSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null
    },
    implementation
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
  const implementation = implementationTrustFingerprint(implementationConfig);
  const record = buildTrustRecord(configDir, projectConfig, implementation);
  fs.writeFileSync(path.join(configDir, TEMPLATE_TRUST_FILE), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {void}
 */
export function assertTrustedImplementation(implementationInfo, projectConfig = null) {
  if (!implementationRequiresTrust(implementationInfo)) {
    return;
  }
  const fingerprint = implementationTrustFingerprint(implementationInfo.config);
  const trustRecord = readTemplateTrustRecord(implementationInfo.configDir);
  const configLabel = implementationInfo.configPath || "topogram.project.json";
  if (!trustRecord) {
    throw new Error(
      `Refusing to load executable implementation '${fingerprint.module}' from ${normalizeRoot(configLabel)} without ${TEMPLATE_TRUST_FILE}. ` +
        `Run 'topogram trust template' from the project root after reviewing implementation/.`
    );
  }
  if (trustRecord.trustPolicy !== TEMPLATE_TRUST_POLICY) {
    throw new Error(
      `${TEMPLATE_TRUST_FILE} uses unsupported trust policy '${trustRecord.trustPolicy}'. Run 'topogram trust template' to refresh it.`
    );
  }
  if (trustRecord.implementation?.module !== fingerprint.module) {
    throw new Error(
      `${TEMPLATE_TRUST_FILE} trusts implementation module '${trustRecord.implementation?.module}', but ${normalizeRoot(configLabel)} uses '${fingerprint.module}'. Run 'topogram trust template' after reviewing implementation/.`
    );
  }
  if (trustRecord.implementation?.export !== fingerprint.export) {
    throw new Error(
      `${TEMPLATE_TRUST_FILE} trusts implementation export '${trustRecord.implementation?.export}', but ${normalizeRoot(configLabel)} uses '${fingerprint.export}'. Run 'topogram trust template' after reviewing implementation/.`
    );
  }
  const trustedId = trustRecord.implementation?.id || null;
  if (trustedId !== (fingerprint.id || null)) {
    throw new Error(
      `${TEMPLATE_TRUST_FILE} trusts implementation id '${trustedId || ""}', but ${normalizeRoot(configLabel)} uses '${fingerprint.id || ""}'. Run 'topogram trust template' after reviewing implementation/.`
    );
  }

  const projectTemplate = projectConfig?.template || null;
  if (projectTemplate?.id && trustRecord.template?.id !== projectTemplate.id) {
    throw new Error(
      `${TEMPLATE_TRUST_FILE} trusts template '${trustRecord.template?.id}', but topogram.project.json declares '${projectTemplate.id}'. Run 'topogram trust template' after reviewing implementation/.`
    );
  }
  if (projectTemplate?.version && trustRecord.template?.version !== projectTemplate.version) {
    throw new Error(
      `${TEMPLATE_TRUST_FILE} trusts template version '${trustRecord.template?.version}', but topogram.project.json declares '${projectTemplate.version}'. Run 'topogram trust template' after reviewing implementation/.`
    );
  }
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }|null} projectConfigInfo
 * @returns {{ ok: boolean, errors: Array<{ message: string, loc: any }> }}
 */
export function validateProjectImplementationTrust(projectConfigInfo) {
  if (!projectConfigInfo?.config?.implementation) {
    return { ok: true, errors: [] };
  }
  const implementationModule =
    projectConfigInfo.config.implementation.implementation_module ||
    projectConfigInfo.config.implementation.module;
  if (!implementationModule) {
    return { ok: true, errors: [] };
  }
  const implementationInfo = {
    config: projectConfigInfo.config.implementation,
    configPath: projectConfigInfo.configPath,
    configDir: projectConfigInfo.configDir
  };
  try {
    assertTrustedImplementation(implementationInfo, projectConfigInfo.config);
    return { ok: true, errors: [] };
  } catch (error) {
    return {
      ok: false,
      errors: [{
        message: error instanceof Error ? error.message : String(error),
        loc: null
      }]
    };
  }
}
