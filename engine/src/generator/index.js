import { resolveWorkspace } from "../resolver.js";
import { generateDocs, generateDocsIndex } from "./docs.js";
import {
  generateJsonSchema,
  generateShapeTransformDebug,
  generateShapeTransformGraph
} from "./schema.js";
import {
  generateApiContractDebug,
  generateApiContractGraph,
  generateOpenApi
} from "./api.js";
import { generateVerificationChecklist, generateVerificationPlan } from "./verification.js";
import { generateUiComponentContract } from "./components.js";
import { generateComponentConformanceReport } from "./component-conformance.js";
import { generateDbTarget } from "./surfaces/databases/index.js";
import { generateAppTarget } from "./surfaces/index.js";
import { generateRuntimeTarget } from "./runtime/index.js";
import { generateContextTarget } from "./context/index.js";
import { generateSdlcTarget } from "./sdlc/index.js";
import { buildOutputFiles } from "./output.js";

function okResult(target, artifact) {
  return {
    ok: true,
    target,
    artifact
  };
}

export function generateWorkspace(workspaceAst, options = {}) {
  const resolved = resolveWorkspace(workspaceAst);
  if (!resolved.ok) {
    return {
      ok: false,
      validation: resolved.validation
    };
  }

  const { graph } = resolved;
  const { target } = options;

  if (target === "json-schema") {
    return okResult(target, generateJsonSchema(graph, options));
  }
  if (target === "docs") {
    return okResult(target, generateDocs(graph, options));
  }
  if (target === "docs-index") {
    return okResult(target, generateDocsIndex(graph, options));
  }
  if (target === "shape-transform-graph") {
    return okResult(target, generateShapeTransformGraph(graph, options));
  }
  if (target === "shape-transform-debug") {
    return okResult(target, generateShapeTransformDebug(graph, options));
  }
  if (target === "api-contract-graph") {
    return okResult(target, generateApiContractGraph(graph, options));
  }
  if (target === "api-contract-debug") {
    return okResult(target, generateApiContractDebug(graph, options));
  }
  if (target === "openapi") {
    return okResult(target, generateOpenApi(graph, options));
  }
  if (target === "verification-plan") {
    return okResult(target, generateVerificationPlan(graph, options));
  }
  if (target === "verification-checklist") {
    return okResult(target, generateVerificationChecklist(graph, options));
  }
  if (target === "ui-component-contract") {
    return okResult(target, generateUiComponentContract(graph, options));
  }
  if (target === "component-conformance-report") {
    return okResult(target, generateComponentConformanceReport(graph, options));
  }

  if (
    target === "db-contract-graph" ||
    target === "db-contract-debug" ||
    target === "db-schema-snapshot" ||
    target === "db-migration-plan" ||
    target === "db-lifecycle-plan" ||
    target === "db-lifecycle-bundle" ||
    target === "sql-schema" ||
    target === "sql-migration" ||
    target === "prisma-schema" ||
    target === "drizzle-schema"
  ) {
    return okResult(target, generateDbTarget(target, graph, options));
  }

  if (
    target === "ui-contract-graph" ||
    target === "ui-contract-debug" ||
    target === "ui-web-contract" ||
    target === "ui-web-debug" ||
    target === "sveltekit-app" ||
    target === "server-contract" ||
    target === "persistence-scaffold" ||
    target === "hono-server" ||
    target === "express-server" ||
    target === "swiftui-app"
  ) {
    return okResult(target, generateAppTarget(target, graph, options));
  }

  if (
    target === "context-digest" ||
    target === "context-diff" ||
    target === "context-slice" ||
    target === "context-bundle" ||
    target === "context-report" ||
    target === "context-task-mode" ||
    target === "domain-coverage" ||
    target === "domain-list" ||
    target === "domain-page"
  ) {
    return okResult(target, generateContextTarget(target, graph, options));
  }

  if (
    target === "sdlc-board" ||
    target === "sdlc-doc-page" ||
    target === "sdlc-release-notes" ||
    target === "sdlc-traceability-matrix"
  ) {
    return okResult(target, generateSdlcTarget(target, graph, options));
  }

  if (
    target === "environment-plan" ||
    target === "environment-bundle" ||
    target === "deployment-plan" ||
    target === "deployment-bundle" ||
    target === "runtime-smoke-plan" ||
    target === "runtime-smoke-bundle" ||
    target === "runtime-check-plan" ||
    target === "runtime-check-bundle" ||
    target === "compile-check-plan" ||
    target === "compile-check-bundle" ||
    target === "app-bundle-plan" ||
    target === "app-bundle" ||
    target === "native-parity-plan" ||
    target === "native-parity-bundle"
  ) {
    return okResult(target, generateRuntimeTarget(target, graph, options));
  }

  throw new Error(`Unsupported generator target '${target}'`);
}

export { buildOutputFiles };
