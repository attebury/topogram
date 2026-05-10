// @ts-check

/**
 * @typedef {import("./registry/index.js").GeneratorManifest} GeneratorManifest
 */

export {
  GENERATOR_MANIFESTS,
  generatorProfile,
  getGeneratorManifest,
  isApiProjection,
  isGeneratorCompatible,
  loadPackageGeneratorManifest,
  packageGeneratorInstallCommand,
  packageGeneratorInstallHint,
  projectionCompatibilityKey,
  resolveGeneratorManifestForBinding,
  resolvePackageGeneratorManifestPath,
  validateGeneratorManifest,
  validateGeneratorRegistry
} from "./registry/index.js";
