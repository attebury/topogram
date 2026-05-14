// @ts-check

import path from "node:path";

import {
  implementationOutsideRootMessage,
  normalizeRoot,
  TEMPLATE_TRUST_FILE,
  TEMPLATE_TRUST_POLICY,
  templateTrustRecoveryGuidance
} from "./constants.js";
import {
  diffContentFiles,
  hashImplementationContent
} from "./content.js";
import {
  implementationModuleIsUnderRoot,
  implementationRequiresTrust,
  implementationTrustFingerprint
} from "./policy.js";
import { readTemplateTrustRecord } from "./record.js";

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {void}
 */
export function assertTrustedImplementation(implementationInfo, projectConfig = null) {
  const status = getTemplateTrustStatus(implementationInfo, projectConfig);
  if (!status.requiresTrust || status.ok) {
    return;
  }
  const firstIssue = status.issues[0] || "implementation trust is invalid";
  const guidance = templateTrustRecoveryGuidance(firstIssue);
  throw new Error(
    guidance ? `${firstIssue}. ${guidance}` : firstIssue
  );
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {{ ok: boolean, requiresTrust: boolean, trustPath: string, trustRecord: import("./record.js").TemplateTrustRecord|null, template: { id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, catalog?: Record<string, any>|null, includesExecutableImplementation: boolean|null }, implementation: { id: string|null, module: string|null, export: string|null }, content: { trustedDigest: string|null, currentDigest: string|null, added: string[], removed: string[], changed: string[] }, issues: string[] }}
 */
export function getTemplateTrustStatus(implementationInfo, projectConfig = null) {
  if (!implementationRequiresTrust(implementationInfo, projectConfig)) {
    return {
      ok: true,
      requiresTrust: false,
      trustPath: path.join(implementationInfo.configDir, TEMPLATE_TRUST_FILE),
      trustRecord: null,
      template: { id: null, version: null, source: null, sourceSpec: null, requested: null, sourceRoot: null, catalog: null, includesExecutableImplementation: null },
      implementation: { id: null, module: null, export: null },
      content: { trustedDigest: null, currentDigest: null, added: [], removed: [], changed: [] },
      issues: []
    };
  }
  const fingerprint = implementationTrustFingerprint(implementationInfo.config);
  const moduleInsideImplementation = implementationModuleIsUnderRoot(implementationInfo);
  const trustRecord = readTemplateTrustRecord(implementationInfo.configDir);
  const configLabel = implementationInfo.configPath || "topogram.project.json";
  const trustPath = path.join(implementationInfo.configDir, TEMPLATE_TRUST_FILE);
  const projectTemplate = projectConfig?.template || null;
  /** @type {string[]} */
  const issues = [];
  /** @type {{ trustedDigest: string|null, currentDigest: string|null, added: string[], removed: string[], changed: string[] }} */
  const contentStatus = { trustedDigest: null, currentDigest: null, added: [], removed: [], changed: [] };

  if (!moduleInsideImplementation) {
    issues.push(implementationOutsideRootMessage(fingerprint.module));
  }

  if (!trustRecord) {
    issues.push(
      `Refusing to load executable implementation '${fingerprint.module}' from ${normalizeRoot(configLabel)} without ${TEMPLATE_TRUST_FILE}`
    );
  } else {
    if (trustRecord.trustPolicy !== TEMPLATE_TRUST_POLICY) {
      issues.push(`${TEMPLATE_TRUST_FILE} uses unsupported trust policy '${trustRecord.trustPolicy}'`);
    }
    if (trustRecord.implementation?.module !== fingerprint.module) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts implementation module '${trustRecord.implementation?.module}', but ${normalizeRoot(configLabel)} uses '${fingerprint.module}'`);
    }
    if (trustRecord.implementation?.export !== fingerprint.export) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts implementation export '${trustRecord.implementation?.export}', but ${normalizeRoot(configLabel)} uses '${fingerprint.export}'`);
    }
    const trustedId = trustRecord.implementation?.id || null;
    if (trustedId !== (fingerprint.id || null)) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts implementation id '${trustedId || ""}', but ${normalizeRoot(configLabel)} uses '${fingerprint.id || ""}'`);
    }

    if (projectTemplate?.id && trustRecord.template?.id !== projectTemplate.id) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts template '${trustRecord.template?.id}', but topogram.project.json declares '${projectTemplate.id}'`);
    }
    if (projectTemplate?.version && trustRecord.template?.version !== projectTemplate.version) {
      issues.push(`${TEMPLATE_TRUST_FILE} trusts template version '${trustRecord.template?.version}', but topogram.project.json declares '${projectTemplate.version}'`);
    }

    if (!moduleInsideImplementation) {
      // The module itself is outside the only supported trust root. Do not
      // pretend the implementation/ content digest covers the executable code.
    } else if (!trustRecord.content) {
      issues.push(`${TEMPLATE_TRUST_FILE} is missing implementation content hashes`);
    } else if (trustRecord.content.algorithm !== "sha256") {
      issues.push(`${TEMPLATE_TRUST_FILE} uses unsupported content hash algorithm '${trustRecord.content.algorithm}'`);
    } else {
      try {
        const currentContent = hashImplementationContent(implementationInfo.configDir);
        contentStatus.trustedDigest = trustRecord.content.digest;
        contentStatus.currentDigest = currentContent.digest;
        const trustedByPath = new Map((trustRecord.content.files || []).map((file) => [file.path, file]));
        const currentByPath = new Map(currentContent.files.map((file) => [file.path, file]));
        const diff = diffContentFiles(trustedByPath, currentByPath);
        contentStatus.added = diff.added;
        contentStatus.removed = diff.removed;
        contentStatus.changed = diff.changed;
        if (trustRecord.content.digest !== currentContent.digest) {
          issues.push(`${TEMPLATE_TRUST_FILE} implementation content changed since it was last trusted`);
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  return {
    ok: issues.length === 0,
    requiresTrust: true,
    trustPath,
    trustRecord,
    template: {
      id: projectTemplate?.id || trustRecord?.template?.id || null,
      version: projectTemplate?.version || trustRecord?.template?.version || null,
      source: projectTemplate?.source || trustRecord?.template?.source || null,
      sourceSpec: projectTemplate?.sourceSpec || trustRecord?.template?.sourceSpec || null,
      requested: projectTemplate?.requested || trustRecord?.template?.requested || null,
      sourceRoot: projectTemplate?.sourceRoot || trustRecord?.template?.sourceRoot || null,
      catalog: projectTemplate?.catalog || trustRecord?.template?.catalog || null,
      includesExecutableImplementation: typeof projectTemplate?.includesExecutableImplementation === "boolean"
        ? projectTemplate.includesExecutableImplementation
        : null
    },
    implementation: fingerprint,
    content: contentStatus,
    issues
  };
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
