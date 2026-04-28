import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
      "Add topogram.implementation.json with implementation_module, or pass an implementation provider in generator options."
  );
}

export function findImplementationConfig(root) {
  let current = normalizeSearchRoot(root);
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, "topogram.implementation.json");
    if (fs.existsSync(candidate)) {
      return {
        config: JSON.parse(fs.readFileSync(candidate, "utf8")),
        configPath: candidate,
        configDir: path.dirname(candidate)
      };
    }
    current = path.dirname(current);
  }
  return null;
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
  if (!config.implementation_module) {
    throw new Error(
      `Topogram implementation config ${normalizeRoot(configPath)} is missing implementation_module.`
    );
  }

  const modulePath = path.resolve(configDir, config.implementation_module);
  const module = await import(pathToFileURL(modulePath).href);
  const exportName = config.implementation_export || "default";
  const implementation = module[exportName];
  if (!implementation) {
    throw new Error(
      `Topogram implementation module ${normalizeRoot(modulePath)} does not export '${exportName}'.`
    );
  }
  if (
    config.implementation_id &&
    implementation.exampleId &&
    implementation.exampleId !== config.implementation_id
  ) {
    throw new Error(
      `Topogram implementation config requested '${config.implementation_id}', ` +
        `but provider exported '${implementation.exampleId}'.`
    );
  }
  return implementation;
}
