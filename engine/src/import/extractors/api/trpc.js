import {
  dedupeCandidateRecords,
  findImportFiles,
  inferApiEntityIdFromPath,
  makeCandidateRecord,
  pluralizeCandidateTerm,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function splitTopLevelProperties(block) {
  const props = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let quote = null;
  for (let i = 0; i < block.length; i += 1) {
    const ch = block[i];
    const prev = block[i - 1];
    if (inString) {
      current += ch;
      if (ch === quote && prev !== "\\") {
        inString = false;
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inString = true;
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      if (current.trim()) props.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) props.push(current.trim());
  return props;
}

function parseInputFields(entryBody) {
  const objectMatch = entryBody.match(/\.input\s*\(\s*z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)\s*(?:,|\))/m);
  if (!objectMatch) return [];
  const fields = [];
  for (const prop of splitTopLevelProperties(objectMatch[1])) {
    const propMatch = prop.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (propMatch) fields.push(propMatch[1]);
  }
  return [...new Set(fields)].sort();
}

function parseNamedSelects(text) {
  const namedSelects = new Map();
  for (const match of text.matchAll(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([\s\S]*?)\}\s*satisfies\s+Prisma\.[A-Za-z_][A-Za-z0-9_]*Select/g)) {
    const fields = [];
    for (const prop of splitTopLevelProperties(match[2])) {
      const propMatch = prop.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (propMatch) fields.push(propMatch[1]);
    }
    namedSelects.set(match[1], [...new Set(fields)].sort());
  }
  return namedSelects;
}

function inferOutputFields(entryBody, procedureType, resource, namedSelects) {
  const returnObjectMatch = entryBody.match(/return\s*\{([\s\S]*?)\}\s*;?\s*$/m);
  if (returnObjectMatch) {
    const fields = [];
    for (const prop of splitTopLevelProperties(returnObjectMatch[1])) {
      const propMatch = prop.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/);
      if (propMatch) fields.push(propMatch[1]);
    }
    return [...new Set(fields)].sort();
  }
  const selectRefMatch = entryBody.match(/select\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/);
  if (selectRefMatch && namedSelects.has(selectRefMatch[1])) {
    return namedSelects.get(selectRefMatch[1]) || [];
  }
  if (procedureType === "query" && /\bfindUnique\b|\bbyId\b/.test(entryBody)) {
    return [resource];
  }
  if (procedureType === "mutation" && /\bcreate\b/.test(entryBody)) {
    return [resource];
  }
  return [];
}

function inferCapabilityId(routerResource, procedureName, procedureType) {
  const resource = routerResource.replace(/-/g, "_");
  if (/^list$/i.test(procedureName)) return `cap_list_${pluralizeCandidateTerm(resource)}`;
  if (/^(byid|get|detail)$/i.test(procedureName)) return `cap_get_${resource}`;
  if (/^(add|create|new)$/i.test(procedureName)) return `cap_create_${resource}`;
  if (/^(update|edit|patch)$/i.test(procedureName)) return `cap_update_${resource}`;
  if (/^(delete|remove)$/i.test(procedureName)) return `cap_delete_${resource}`;
  const verb = procedureType === "mutation" ? "mutate" : "get";
  return `cap_${verb}_${resource}_${procedureName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}`;
}

function inferEndpointPath(routerResource, procedureName, procedureType) {
  const resourcePath = `/${pluralizeCandidateTerm(routerResource).replace(/_/g, "-")}`;
  if (/^list$/i.test(procedureName)) return { method: "GET", path: resourcePath };
  if (/^(byid|get|detail)$/i.test(procedureName)) return { method: "GET", path: `${resourcePath}/{id}` };
  if (/^(add|create|new)$/i.test(procedureName)) return { method: "POST", path: resourcePath };
  if (/^(update|edit|patch)$/i.test(procedureName)) return { method: "PATCH", path: `${resourcePath}/{id}` };
  if (/^(delete|remove)$/i.test(procedureName)) return { method: "DELETE", path: `${resourcePath}/{id}` };
  return { method: procedureType === "mutation" ? "POST" : "GET", path: `${resourcePath}/${procedureName}` };
}

function parseRouterProcedures(filePath, text) {
  const routerDecl = text.match(/export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)Router\s*=\s*router\s*\(\s*\{/m);
  if (!routerDecl) return [];
  const routerName = routerDecl[1];
  const routerResource = routerName.replace(/Router$/, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const routerText = text.slice(routerDecl.index);
  const namedSelects = parseNamedSelects(text);
  const procedures = [];
  for (const entryMatch of routerText.matchAll(/(^|\n)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*publicProcedure([\s\S]*?)\.(query|mutation)\s*\(\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*,?/g)) {
    const procedureName = entryMatch[2];
    const entryBody = entryMatch[3];
    const procedureType = entryMatch[4];
    const resolverBody = entryMatch[5];
    const endpoint = inferEndpointPath(routerResource, procedureName, procedureType);
    const capabilityId = inferCapabilityId(routerResource, procedureName, procedureType);
    procedures.push({
      file: filePath,
      routerName,
      routerResource,
      procedureName,
      procedureType,
      id_hint: capabilityId,
      endpoint,
      input_fields: parseInputFields(entryBody),
      output_fields: inferOutputFields(resolverBody, procedureType, routerResource, namedSelects),
      entity_id: inferApiEntityIdFromPath(endpoint.path),
      auth_hint: /protectedProcedure/.test(entryBody) ? "secured" : "public"
    });
  }
  return procedures;
}

export const trpcExtractor = {
  id: "api.trpc",
  track: "api",
  detect(context) {
    const routerFiles = findImportFiles(context.paths, (filePath) => /src\/server\/routers\/.+\.(ts|tsx|js|jsx)$/i.test(filePath));
    const trpcHandler = findImportFiles(context.paths, (filePath) => /src\/pages\/api\/trpc\/\[trpc\]\.(ts|tsx|js|jsx)$/i.test(filePath));
    return {
      score: routerFiles.length > 0 && trpcHandler.length > 0 ? 88 : 0,
      reasons: routerFiles.length > 0 && trpcHandler.length > 0 ? ["Found tRPC router modules and Next.js tRPC handler"] : []
    };
  },
  extract(context) {
    const routerFiles = findImportFiles(context.paths, (filePath) => /src\/server\/routers\/.+\.(ts|tsx|js|jsx)$/i.test(filePath))
      .filter((filePath) => !/\/_app\.(ts|tsx|js|jsx)$/i.test(filePath) && !/\.test\./i.test(filePath));
    const procedures = routerFiles.flatMap((filePath) => parseRouterProcedures(filePath, context.helpers.readTextIfExists(filePath) || ""));
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (procedures.length > 0) {
      findings.push({
        kind: "trpc_procedures",
        files: [...new Set(procedures.map((entry) => relativeTo(context.paths.repoRoot, entry.file)))],
        capability_count: procedures.length
      });
      candidates.capabilities.push(...procedures.map((entry) => makeCandidateRecord({
        kind: "capability",
        idHint: entry.id_hint,
        label: titleCase(entry.id_hint.replace(/^cap_/, "")),
        confidence: "high",
        sourceKind: "route_code",
        provenance: `${relativeTo(context.paths.repoRoot, entry.file)}#${entry.routerName}.${entry.procedureName}`,
        endpoint: entry.endpoint,
        path_params: /\{id\}/.test(entry.endpoint.path) ? [{ name: "id", required: true, type: null }] : [],
        query_params: [],
        header_params: [],
        input_fields: entry.input_fields,
        output_fields: entry.output_fields,
        auth_hint: entry.auth_hint,
        entity_id: entry.entity_id,
        track: "api"
      })));
      candidates.routes.push(...procedures.map((entry) => ({
        path: entry.endpoint.path,
        method: entry.endpoint.method,
        confidence: "high",
        source_kind: "route_code",
        provenance: `${relativeTo(context.paths.repoRoot, entry.file)}#${entry.routerName}.${entry.procedureName}`
      })));
      candidates.stacks.push("trpc");
    }
    candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(
      candidates.routes.map((route) => ({ ...route, id_hint: `${route.method}_${route.path}` })),
      (record) => `${record.method}:${record.path}:${record.source_kind}`
    ).map(({ id_hint, ...route }) => route);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
