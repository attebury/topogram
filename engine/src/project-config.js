// @ts-check

/**
 * @typedef {import("./project-config/index.js").GeneratorBinding} GeneratorBinding
 * @typedef {import("./project-config/index.js").RuntimeMigrationStrategy} RuntimeMigrationStrategy
 * @typedef {import("./project-config/index.js").RuntimeTopologyRuntime} RuntimeTopologyRuntime
 * @typedef {import("./project-config/index.js").ProjectConfig} ProjectConfig
 * @typedef {import("./project-config/index.js").ProjectConfigInfo} ProjectConfigInfo
 * @typedef {import("./project-config/index.js").ValidationError} ValidationError
 */

export {
  defaultProjectConfigForGraph,
  findLegacyImplementationConfig,
  findProjectConfig,
  formatProjectConfigErrors,
  loadProjectConfig,
  outputOwnershipForPath,
  projectConfigOrDefault,
  resolveOutputPath,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "./project-config/index.js";
