import { generateDbTarget } from "../../db/index.js";
import { buildBackendRuntimeRealization } from "../../../realization/backend/index.js";
import { getProjection } from "../shared.js";
import { generatePersistenceScaffold } from "./persistence-wiring.js";
import {
  renderServerContextTs,
  renderServerHelpers,
  renderServerIndexTs,
  renderServerPackageJson,
  renderServerSeedScript,
  renderServerTsconfig,
  routeTypeNames,
} from "./runtime-helpers.js";
import { generateServerContract, renderServerContractModule } from "./server-contract.js";
import { toPascalCase } from "../../db/shared.js";
import { getExampleImplementation } from "../../../example-implementation.js";

function renderServerAppTs(realization) {
  const { contract, lookupRoutes } = realization;
  const lines = [];
  const typeImportNames = routeTypeNames(contract);
  const serviceName = realization.backendReference.serviceName;
  const defaultWebPort = realization.runtimeReference?.ports?.web || 5173;
  const repositoryReference = realization.repositoryReference;
  const dependencyName = repositoryReference.dependencyName;
  const preconditionCapabilityIds = repositoryReference.preconditionCapabilityIds;
  const preconditionResource = repositoryReference.preconditionResource;
  const preconditionVariableName = preconditionResource.variableName || "currentResource";
  const downloadCapabilityId = repositoryReference.downloadCapabilityId;

  lines.push('import { Hono } from "hono";');
  lines.push('import { cors } from "hono/cors";');
  lines.push('import type { Context } from "hono";');
  lines.push('import { serverContract } from "../topogram/server-contract";');
  lines.push('import { HttpError, coerceValue, contentDisposition, jsonError, requireHeaders, requireRequestFields } from "./helpers";');
  lines.push('import type { ServerDependencies } from "./context";');
  lines.push(`import type { ${typeImportNames.join(", ")} } from "../persistence/types";`);
  lines.push("");
  lines.push("function buildInput(c: Context, route: any, body: Record<string, unknown>) {");
  lines.push("  const input: Record<string, unknown> = {};");
  lines.push("  for (const field of (route.requestContract?.transport.path || []) as any[]) {");
  lines.push("    input[field.name] = coerceValue(c.req.param(field.transport.wireName), field.schema);");
  lines.push("  }");
  lines.push("  for (const field of (route.requestContract?.transport.query || []) as any[]) {");
  lines.push("    input[field.name] = coerceValue(c.req.query(field.transport.wireName), field.schema);");
  lines.push("  }");
  lines.push("  for (const field of (route.requestContract?.transport.header || []) as any[]) {");
  lines.push("    input[field.name] = coerceValue(c.req.header(field.transport.wireName), field.schema);");
  lines.push("  }");
  lines.push("  for (const field of (route.requestContract?.transport.body || []) as any[]) {");
  lines.push('    const defaultValue = field.schema && typeof field.schema === "object" && "default" in field.schema ? field.schema.default : undefined;');
  lines.push("    input[field.name] = body[field.transport.wireName] ?? defaultValue;");
  lines.push("  }");
  lines.push("  return input;");
  lines.push("}");
  lines.push("");
  lines.push("function corsOrigin(origin: string) {");
  lines.push(`  const configured = process.env.TOPOGRAM_CORS_ORIGINS || "http://localhost:${defaultWebPort},http://127.0.0.1:${defaultWebPort}";`);
  lines.push("  const allowed = new Set(configured.split(\",\").map((entry) => entry.trim()).filter(Boolean));");
  lines.push("  return allowed.has(origin) ? origin : \"\";");
  lines.push("}");
  lines.push("");
  lines.push("export function createApp(deps: ServerDependencies) {");
  lines.push("  const app = new Hono();");
  lines.push('  app.use("*", cors({');
  lines.push("    origin: corsOrigin,");
  lines.push('    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],');
  lines.push('    allowHeaders: ["Content-Type", "If-Match", "If-None-Match", "Idempotency-Key", "Authorization"],');
  lines.push('    exposeHeaders: ["ETag", "Location", "Retry-After", "Content-Disposition"]');
  lines.push("  }));");
  lines.push("");
  lines.push(`  app.get("/health", (c) => c.json({ ok: true, service: "${serviceName}" }, 200 as any));`);
  lines.push("");
  lines.push('  app.get("/ready", async (c) => {');
  lines.push("    try {");
  lines.push("      await deps.ready?.();");
  lines.push(`      return c.json({ ok: true, ready: true, service: "${serviceName}" }, 200 as any);`);
  lines.push("    } catch (error) {");
  lines.push('      const message = error instanceof Error ? error.message : "Readiness check failed";');
  lines.push(`      return c.json({ ok: false, ready: false, service: "${serviceName}", message }, 503 as any);`);
  lines.push("    }");
  lines.push("  });");
  lines.push("");

  for (const lookup of lookupRoutes) {
    lines.push(`  app.get("${lookup.route}", async (c) => {`);
    lines.push("    try {");
    lines.push(`      const result = await deps.${dependencyName}.${lookup.repositoryMethod}();`);
    lines.push("      return c.json(result, 200 as any);");
    lines.push("    } catch (error) {");
    lines.push("      const failure = jsonError(error);");
    lines.push("      return c.json(failure.body, failure.status as any);");
    lines.push("    }");
    lines.push("  });");
    lines.push("");
  }

  contract.routes.forEach((route, routeIndex) => {
    const method = route.method.toLowerCase();
    const routeVar = `route${routeIndex}`;
    const responseMode = route.responseContract?.mode || "item";
    const methodName = route.repositoryMethod;
    const hasOwnershipAuthz = (route.endpoint.authz || []).some((rule) => rule.ownership && rule.ownership !== "none");
    const authLoaderVar = `loadAuthorizationResource${routeIndex}`;
    lines.push(`  const ${routeVar} = serverContract.routes[${routeIndex}]!;`);
    lines.push(`  app.${method}(${routeVar}.path, async (c) => {`);
    lines.push("    try {");
    const needsBody = (route.requestContract?.transport.body || []).length > 0;
    if (needsBody) {
      lines.push("      const body = await c.req.json().catch(() => ({}));");
    } else {
      lines.push("      const body = {};");
    }
    lines.push(`      const input = buildInput(c, ${routeVar}, body);`);
    if ((route.endpoint.authz || []).length > 0) {
      if (hasOwnershipAuthz) {
        if (preconditionCapabilityIds.includes(route.capabilityId)) {
          lines.push(`      const ${authLoaderVar} = async () => await deps.${dependencyName}.${preconditionResource.repositoryMethod}({ ${preconditionResource.inputField}: String(input.${preconditionResource.inputField} || "") } as unknown as ${toPascalCase(preconditionResource.repositoryMethod)}Input) as unknown as Record<string, unknown>;`);
        } else if (route.method === "GET" && responseMode === "item") {
          lines.push(`      const ${authLoaderVar} = async () => await deps.${dependencyName}.${methodName}(input as unknown as ${toPascalCase(methodName)}Input) as unknown as Record<string, unknown>;`);
        } else {
          lines.push(`      const ${authLoaderVar} = undefined;`);
        }
      }
      lines.push('      if (!deps.authorize) throw new HttpError(500, "authorization_handler_missing", "Missing authorization handler for protected route");');
      lines.push(`      await deps.authorize(c, ${routeVar}.endpoint.authz, { capabilityId: ${routeVar}.capabilityId, input, ${hasOwnershipAuthz ? `loadResource: typeof ${authLoaderVar} === "function" ? ${authLoaderVar} : undefined` : "loadResource: undefined"} });`);
    }
    if ((route.endpoint.preconditions || []).length > 0 || (route.endpoint.idempotency || []).length > 0) {
      lines.push(`      requireHeaders(c, [...${routeVar}.endpoint.preconditions, ...${routeVar}.endpoint.idempotency]);`);
    }
    lines.push(`      requireRequestFields(${routeVar}, input);`);
    if (preconditionCapabilityIds.includes(route.capabilityId)) {
      lines.push('      const ifMatch = c.req.header("If-Match");');
      lines.push('      if (ifMatch) {');
      lines.push(`        const ${preconditionVariableName} = await deps.${dependencyName}.${preconditionResource.repositoryMethod}({ ${preconditionResource.inputField}: String(input.${preconditionResource.inputField} || "") } as unknown as ${toPascalCase(preconditionResource.repositoryMethod)}Input);`);
      lines.push(`        if (${preconditionVariableName}.${preconditionResource.versionField} !== ifMatch) {`);
      lines.push('          throw new HttpError(412, "stale_precondition", "If-Match does not match the current resource version");');
      lines.push("        }");
      lines.push("      }");
    }

    if (route.capabilityId === downloadCapabilityId) {
      lines.push(`      const artifact = await deps.${dependencyName}.${methodName}(input as unknown as ${toPascalCase(methodName)}Input);`);
      lines.push("      const responseHeaders = new Headers();");
      lines.push(`      responseHeaders.set("Content-Type", artifact.contentType || "${route.endpoint.download?.[0]?.media || "application/octet-stream"}");`);
      lines.push(`      responseHeaders.set("Content-Disposition", contentDisposition("${route.endpoint.download?.[0]?.disposition || "attachment"}", artifact.filename || "${route.endpoint.download?.[0]?.filename || "download.bin"}"));`);
      lines.push(`      return new Response(artifact.body as BodyInit | null, { status: ${route.successStatus}, headers: responseHeaders });`);
    } else {
      lines.push(`      const result = await deps.${dependencyName}.${methodName}(input as unknown as ${toPascalCase(methodName)}Input);`);
      if ((route.endpoint.cache || []).length > 0) {
        const cacheRule = route.endpoint.cache[0];
        lines.push(`      const etag = (result as unknown as Record<string, unknown>)["${cacheRule.source}"];`);
        lines.push(`      if (etag && c.req.header("${cacheRule.requestHeader}") === String(etag)) {`);
        lines.push(`        return c.body(null, ${cacheRule.notModified} as any);`);
        lines.push("      }");
        lines.push(`      if (etag) c.header("${cacheRule.responseHeader}", String(etag));`);
      }
      if ((route.endpoint.async || []).length > 0) {
        const asyncRule = route.endpoint.async[0];
        lines.push(`      c.header("${asyncRule.locationHeader}", (result as unknown as Record<string, unknown>).status_url ? String((result as unknown as Record<string, unknown>).status_url) : "${asyncRule.statusPath}".replace(":job_id", String((result as unknown as Record<string, unknown>).job_id ?? "")));`);
        lines.push(`      c.header("${asyncRule.retryAfterHeader}", "5");`);
      }
      if (responseMode === "item" || responseMode === "cursor" || responseMode === "paged" || responseMode === "collection") {
        lines.push(`      return c.json(result as ${toPascalCase(methodName)}Result, ${route.successStatus} as any);`);
      } else {
        lines.push(`      return c.json(result, ${route.successStatus} as any);`);
      }
    }
    lines.push("    } catch (error) {");
    lines.push("      const failure = jsonError(error);");
    lines.push("      return c.json(failure.body, failure.status as any);");
    lines.push("    }");
    lines.push("  });");
    lines.push("");
  });

  lines.push("  return app;");
  lines.push("}");
  lines.push("");
  lines.push("export type AppType = ReturnType<typeof createApp>;");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function generateHonoServer(graph, options = {}) {
  const projection = getProjection(graph, options.projectionId);
  const realization = buildBackendRuntimeRealization(graph, options);
  const contract = realization.contract;
  const persistenceScaffold = generatePersistenceScaffold(graph, { projectionId: realization.dbProjection.id });
  const prismaSchema = generateDbTarget("prisma-schema", graph, { projectionId: realization.dbProjection.id });

  return {
    "package.json": renderServerPackageJson(),
    "tsconfig.json": renderServerTsconfig(),
    "scripts/seed-demo.mjs": renderServerSeedScript(graph),
    "src/index.ts": renderServerIndexTs(graph),
    "src/lib/topogram/server-contract.ts": renderServerContractModule(graph, projection.id),
    "src/lib/server/helpers.ts": renderServerHelpers(),
    "src/lib/server/context.ts": renderServerContextTs(contract, graph),
    "src/lib/server/app.ts": renderServerAppTs(realization),
    "src/lib/persistence/types.ts": persistenceScaffold["types.ts"],
    "src/lib/persistence/repositories.ts": persistenceScaffold["repositories.ts"],
    "src/lib/persistence/prisma/repositories.ts": persistenceScaffold["prisma/repositories.ts"],
    "prisma/schema.prisma": prismaSchema
  };
}
