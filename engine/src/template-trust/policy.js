// @ts-check

import path from "node:path";

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
export function isSameOrInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
 * @param {Record<string, any>|null} projectConfig
 * @returns {boolean}
 */
export function projectHasTemplateAttachment(projectConfig) {
  const template = projectConfig?.template || null;
  return Boolean(template?.id || template?.sourceSpec || template?.requested);
}

/**
 * @param {{ config: Record<string, any>, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} [projectConfig]
 * @returns {boolean}
 */
export function implementationRequiresTrust(implementationInfo, projectConfig = null) {
  void projectConfig;
  implementationTrustFingerprint(implementationInfo.config);
  return true;
}

/**
 * @param {{ config: Record<string, any>, configDir: string }} implementationInfo
 * @returns {boolean}
 */
export function implementationModuleIsUnderRoot(implementationInfo) {
  const fingerprint = implementationTrustFingerprint(implementationInfo.config);
  const modulePath = path.resolve(implementationInfo.configDir, fingerprint.module);
  const implementationRoot = path.resolve(implementationInfo.configDir, "implementation");
  return isSameOrInside(implementationRoot, modulePath);
}
