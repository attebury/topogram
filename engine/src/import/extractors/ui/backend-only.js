import path from "node:path";

import { findPrimaryImportFiles, relativeTo } from "../../core/shared.js";

function readPackageJson(context) {
  const packageFile = findPrimaryImportFiles(context.paths, (filePath) => /package\.json$/i.test(filePath))[0];
  if (!packageFile) return null;
  try {
    return {
      filePath: packageFile,
      json: JSON.parse(context.helpers.readTextIfExists(packageFile) || "{}")
    };
  } catch {
    return null;
  }
}

function hasFrontendSignals(context) {
  const packageMeta = readPackageJson(context);
  const deps = {
    ...(packageMeta?.json?.dependencies || {}),
    ...(packageMeta?.json?.devDependencies || {})
  };
  if (deps.react || deps.next || deps["@remix-run/react"] || deps["@sveltejs/kit"] || deps.svelte || deps.vue || deps.nuxt) {
    return true;
  }
  const uiFiles = findPrimaryImportFiles(
    context.paths,
    (filePath) =>
      /(app\/.+\/page\.(tsx|ts|jsx|js|mdx)|src\/App\.tsx|src\/routes\/.+\.(svelte|tsx|jsx)|pages\/.+\.(tsx|ts|jsx|js))$/i.test(filePath)
  );
  return uiFiles.length > 0;
}

export const backendOnlyUiExtractor = {
  id: "ui.backend-only",
  track: "ui",
  detect(context) {
    const packageMeta = readPackageJson(context);
    if (!packageMeta || hasFrontendSignals(context)) {
      return { score: 0, reasons: [] };
    }
    const deps = {
      ...(packageMeta.json.dependencies || {}),
      ...(packageMeta.json.devDependencies || {})
    };
    const isBackend = deps.express || deps.fastify || deps.hono || deps["@nestjs/core"];
    return {
      score: isBackend ? 5 : 0,
      reasons: isBackend ? ["Detected backend-only project with no supported frontend stack"] : []
    };
  },
  extract(context) {
    const packageMeta = readPackageJson(context);
    const provenance = packageMeta ? relativeTo(context.paths.repoRoot, packageMeta.filePath) : relativeTo(context.paths.repoRoot, path.join(context.paths.workspaceRoot, "package.json"));
    return {
      findings: [{
        kind: "backend_only_project",
        file: provenance,
        message: "No supported frontend stack detected in this workspace"
      }],
      candidates: {
        screens: [],
        routes: [],
        actions: [],
        stacks: ["backend_only"]
      }
    };
  }
};
