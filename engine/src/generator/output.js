export function buildOutputFiles(result, options = {}) {
  if (result.target === "context-digest") {
    return Object.keys(result.artifact)
      .sort()
      .map((filePath) => ({
        path: filePath,
        contents: result.artifact[filePath]
      }));
  }

  if (result.target === "context-diff") {
    return [{ path: "context-diff.json", contents: result.artifact }];
  }

  if (result.target === "context-slice") {
    const sliceId =
      options.capabilityId || options.projectionId || options.entityId || options.journeyId || options.workflowId || "context";
    return [{ path: `${sliceId}.context-slice.json`, contents: result.artifact }];
  }

  if (result.target === "context-bundle") {
    const files = [{ path: `context-bundle.${options.taskId || "bundle"}.json`, contents: result.artifact }];
    if (options.taskId === "maintained-app" && result.artifact?.maintained_boundary) {
      files.push({ path: "maintained-boundary.json", contents: result.artifact.maintained_boundary });
    }
    return files;
  }

  if (result.target === "context-report") {
    return [{ path: "context-report.json", contents: result.artifact }];
  }

  if (result.target === "context-task-mode") {
    return [{ path: `${options.modeId || "task-mode"}.context-task-mode.json`, contents: result.artifact }];
  }

  if (result.target === "openapi") {
    return [
      {
        path: options.capabilityId ? `${options.capabilityId}.openapi.json` : "openapi.json",
        contents: result.artifact
      }
    ];
  }

  if (result.target === "api-contract-debug") {
    return [
      {
        path: options.capabilityId ? `${options.capabilityId}.api-contract-debug.md` : "api-contract-debug.md",
        contents: result.artifact
      }
    ];
  }

  if (result.target === "ui-contract-debug") {
    return [
      {
        path: options.projectionId ? `${options.projectionId}.ui-contract-debug.md` : "ui-contract-debug.md",
        contents: result.artifact
      }
    ];
  }

  if (result.target === "api-contract-graph") {
    if (options.capabilityId) {
      return [{ path: `${options.capabilityId}.api-contract-graph.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((capabilityId) => ({
      path: `${capabilityId}.api-contract-graph.json`,
      contents: result.artifact[capabilityId]
    }));
  }

  if (result.target === "ui-contract-graph") {
    if (options.projectionId) {
      return [{ path: `${options.projectionId}.ui-contract-graph.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((projectionId) => ({
      path: `${projectionId}.ui-contract-graph.json`,
      contents: result.artifact[projectionId]
    }));
  }

  if (result.target === "ui-component-contract") {
    if (result.artifact == null) {
      throw new Error("ui-component-contract generator returned no artifact");
    }
    if (options.componentId) {
      return [{ path: `${options.componentId}.ui-component-contract.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((componentId) => ({
      path: `${componentId}.ui-component-contract.json`,
      contents: result.artifact[componentId]
    }));
  }

  if (result.target === "ui-web-debug") {
    return [
      {
        path: options.projectionId ? `${options.projectionId}.ui-web-debug.md` : "ui-web-debug.md",
        contents: result.artifact
      }
    ];
  }

  if (result.target === "ui-web-contract") {
    if (options.projectionId) {
      return [{ path: `${options.projectionId}.ui-web-contract.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((projectionId) => ({
      path: `${projectionId}.ui-web-contract.json`,
      contents: result.artifact[projectionId]
    }));
  }

  if (
    result.target === "sveltekit-app" ||
    result.target === "swiftui-app" ||
    result.target === "db-lifecycle-bundle" ||
    result.target === "environment-bundle" ||
    result.target === "deployment-bundle" ||
    result.target === "runtime-smoke-bundle" ||
    result.target === "runtime-check-bundle" ||
    result.target === "compile-check-bundle" ||
    result.target === "app-bundle" ||
    result.target === "persistence-scaffold" ||
    result.target === "hono-server" ||
    result.target === "express-server"
  ) {
    return Object.keys(result.artifact)
      .sort()
      .map((filePath) => ({
        path: filePath,
        contents: result.artifact[filePath]
      }));
  }

  if (result.target === "db-contract-debug") {
    return [
      {
        path: options.projectionId ? `${options.projectionId}.db-contract-debug.md` : "db-contract-debug.md",
        contents: result.artifact
      }
    ];
  }

  if (result.target === "db-contract-graph") {
    if (options.projectionId) {
      return [{ path: `${options.projectionId}.db-contract-graph.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((projectionId) => ({
      path: `${projectionId}.db-contract-graph.json`,
      contents: result.artifact[projectionId]
    }));
  }

  if (result.target === "db-schema-snapshot") {
    if (options.projectionId) {
      return [{ path: `${options.projectionId}.db-schema-snapshot.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((projectionId) => ({
      path: `${projectionId}.db-schema-snapshot.json`,
      contents: result.artifact[projectionId]
    }));
  }

  if (result.target === "db-migration-plan") {
    return [
      {
        path: options.projectionId ? `${options.projectionId}.db-migration-plan.json` : "db-migration-plan.json",
        contents: result.artifact
      }
    ];
  }

  if (result.target === "db-lifecycle-plan") {
    if (options.projectionId) {
      return [{ path: `${options.projectionId}.db-lifecycle-plan.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((projectionId) => ({
      path: `${projectionId}.db-lifecycle-plan.json`,
      contents: result.artifact[projectionId]
    }));
  }

  if (result.target === "sql-schema") {
    return [{ path: options.projectionId ? `${options.projectionId}.sql` : "schema.sql", contents: result.artifact }];
  }

  if (result.target === "sql-migration") {
    return [{ path: options.projectionId ? `${options.projectionId}.migration.sql` : "migration.sql", contents: result.artifact }];
  }

  if (result.target === "environment-plan") {
    return [{ path: "environment-plan.json", contents: result.artifact }];
  }

  if (result.target === "deployment-plan") {
    return [{ path: options.profileId ? `deployment-plan.${options.profileId}.json` : "deployment-plan.json", contents: result.artifact }];
  }

  if (result.target === "runtime-smoke-plan") {
    return [{ path: "runtime-smoke-plan.json", contents: result.artifact }];
  }

  if (result.target === "runtime-check-plan") {
    return [{ path: "runtime-check-plan.json", contents: result.artifact }];
  }

  if (result.target === "compile-check-plan") {
    return [{ path: "compile-check-plan.json", contents: result.artifact }];
  }

  if (result.target === "app-bundle-plan") {
    return [{ path: "app-bundle-plan.json", contents: result.artifact }];
  }

  if (result.target === "prisma-schema") {
    return [{ path: "schema.prisma", contents: result.artifact }];
  }

  if (result.target === "drizzle-schema") {
    return [{ path: options.projectionId ? `${options.projectionId}.drizzle.ts` : "schema.ts", contents: result.artifact }];
  }

  if (result.target === "server-contract") {
    if (options.projectionId) {
      return [{ path: `${options.projectionId}.server-contract.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((projectionId) => ({
      path: `${projectionId}.server-contract.json`,
      contents: result.artifact[projectionId]
    }));
  }

  if (result.target === "shape-transform-debug") {
    return [{ path: options.shapeId ? `${options.shapeId}.transform-debug.md` : "shape-transform-debug.md", contents: result.artifact }];
  }

  if (result.target === "shape-transform-graph") {
    if (options.shapeId) {
      return [{ path: `${options.shapeId}.transform-graph.json`, contents: result.artifact }];
    }
    return Object.keys(result.artifact).sort().map((shapeId) => ({
      path: `${shapeId}.transform-graph.json`,
      contents: result.artifact[shapeId]
    }));
  }

  if (result.target === "docs") {
    return [{ path: "topogram-docs.md", contents: result.artifact }];
  }

  if (result.target === "docs-index") {
    return [{ path: "docs-index.json", contents: result.artifact }];
  }

  if (result.target === "verification-plan") {
    return [{ path: "verification-plan.json", contents: result.artifact }];
  }

  if (result.target === "verification-checklist") {
    return [{ path: "verification-checklist.md", contents: result.artifact }];
  }

  if (result.target !== "json-schema") {
    throw new Error(`Unsupported file output target '${result.target}'`);
  }

  if (options.shapeId) {
    return [{ path: `${options.shapeId}.schema.json`, contents: result.artifact }];
  }

  return Object.keys(result.artifact)
    .sort()
    .map((shapeId) => ({
      path: `${shapeId}.schema.json`,
      contents: result.artifact[shapeId]
    }));
}
