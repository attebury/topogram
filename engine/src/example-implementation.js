import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  findLegacyImplementationConfig,
  findProjectConfig
} from "./project-config.js";

function normalizeRoot(root) {
  return String(root || "").replace(/\\/g, "/");
}

function normalizeSearchRoot(root) {
  if (!root) {
    return null;
  }
  const absolute = path.resolve(root);
  try {
    return fs.realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function implementationProviderError(root) {
  const suffix = root ? ` for ${normalizeRoot(root)}` : "";
  return new Error(
    `Topogram app/runtime generation requires an explicit implementation provider${suffix}. ` +
      "Add topogram.project.json with implementation.module, or pass an implementation provider in generator options."
  );
}

export function findImplementationConfig(root) {
  const projectConfig = findProjectConfig(root);
  if (projectConfig?.config?.implementation) {
    return {
      config: projectConfig.config.implementation,
      configPath: projectConfig.configPath,
      configDir: projectConfig.configDir
    };
  }
  return findLegacyImplementationConfig(root);
}

export function getExampleImplementation(graph, options = {}) {
  const implementation = options.implementation || options.implementationProvider || null;
  if (implementation) {
    return implementation;
  }
  throw implementationProviderError(graph?.root);
}

export async function loadImplementationProvider(root) {
  const found = findImplementationConfig(root);
  if (!found) {
    throw implementationProviderError(root);
  }

  const { config, configPath, configDir } = found;
  const implementationModule = config.implementation_module || config.module;
  if (!implementationModule) {
    throw new Error(
      `Topogram implementation config ${normalizeRoot(configPath)} is missing implementation module.`
    );
  }

  const modulePath = path.resolve(configDir, implementationModule);
  const module = await import(pathToFileURL(modulePath).href);
  const exportName = config.implementation_export || config.export || "default";
  const implementation = module[exportName];
  if (!implementation) {
    throw new Error(
      `Topogram implementation module ${normalizeRoot(modulePath)} does not export '${exportName}'.`
    );
  }
  if (
    (config.implementation_id || config.id) &&
    implementation.exampleId &&
    implementation.exampleId !== (config.implementation_id || config.id)
  ) {
    throw new Error(
      `Topogram implementation config requested '${config.implementation_id || config.id}', ` +
        `but provider exported '${implementation.exampleId}'.`
    );
  }
  return implementation;
}
