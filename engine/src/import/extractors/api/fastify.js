import path from "node:path";

import {
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  inferApiCapabilityIdFromOperation,
  inferApiEntityIdFromPath,
  makeCandidateRecord,
  normalizeOpenApiPath,
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

function extractBalanced(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let inString = false;
  let quote = null;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const prev = text[i - 1];
    if (inString) {
      if (ch === quote && prev !== "\\") {
        inString = false;
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openIndex, i + 1);
      }
    }
  }
  return null;
}

function findCallArguments(text, calleePattern) {
  const calls = [];
  for (const match of text.matchAll(calleePattern)) {
    const openIndex = text.indexOf("(", match.index);
    if (openIndex < 0) continue;
    const callText = extractBalanced(text, openIndex, "(", ")");
    if (!callText) continue;
    const inner = callText.slice(1, -1);
    calls.push({
      method: match[1].toUpperCase(),
      args: splitTopLevelProperties(inner)
    });
  }
  return calls;
}

function parseNamedTypeboxSchemas(schemaFiles, readText) {
  const schemas = new Map();
  for (const filePath of schemaFiles) {
    const text = readText(filePath) || "";
    for (const match of text.matchAll(/export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Type\.Object\s*\(/g)) {
      const openParenIndex = text.indexOf("(", match.index);
      const objectCall = extractBalanced(text, openParenIndex, "(", ")");
      if (!objectCall) continue;
      const firstBraceIndex = objectCall.indexOf("{");
      if (firstBraceIndex < 0) continue;
      const objectBlock = extractBalanced(objectCall, firstBraceIndex, "{", "}");
      if (!objectBlock) continue;
      schemas.set(match[1], objectBlock);
    }
  }
  return schemas;
}

function parseSchemaExpressionFields(expression, namedSchemas, seen = new Set()) {
  const value = String(expression || "").trim();
  if (!value) return [];

  const identifierMatch = value.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (identifierMatch) {
    const schemaName = identifierMatch[1];
    if (seen.has(schemaName)) return [];
    if (namedSchemas.has(schemaName)) {
      return parseSchemaExpressionFields(namedSchemas.get(schemaName), namedSchemas, new Set([...seen, schemaName]));
    }
    return [];
  }

  if ((value.startsWith("{") && value.endsWith("}"))) {
    const fields = [];
    for (const prop of splitTopLevelProperties(value.slice(1, -1))) {
      const propMatch = prop.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (propMatch) fields.push(propMatch[1]);
    }
    return [...new Set(fields)].sort();
  }

  const typeObjectMatch = value.match(/^Type\.Object\s*\(/);
  if (typeObjectMatch) {
    const firstBraceIndex = value.indexOf("{");
    if (firstBraceIndex < 0) return [];
    const objectBlock = extractBalanced(value, firstBraceIndex, "{", "}");
    if (!objectBlock) return [];
    return parseSchemaExpressionFields(objectBlock, namedSchemas, seen);
  }

  const arrayMatch = value.match(/^Type\.(Array|Optional)\s*\(([\s\S]*)\)$/);
  if (arrayMatch) {
    return parseSchemaExpressionFields(arrayMatch[2], namedSchemas, seen);
  }

  return [];
}

function parseSchemaBlock(optionsArg) {
  const schemaKeyIndex = optionsArg.indexOf("schema:");
  if (schemaKeyIndex < 0) return null;
  const braceIndex = optionsArg.indexOf("{", schemaKeyIndex);
  if (braceIndex < 0) return null;
  return extractBalanced(optionsArg, braceIndex, "{", "}");
}

function parseSchemaEntryExpression(schemaBlock, entryName) {
  const match = schemaBlock.match(new RegExp(`${entryName}\\s*:\\s*`, "m"));
  if (!match || typeof match.index !== "number") return null;
  const start = match.index + match[0].length;
  let i = start;
  while (i < schemaBlock.length && /\s/.test(schemaBlock[i])) i += 1;
  if (i >= schemaBlock.length) return null;
  const ch = schemaBlock[i];
  if (ch === "{") {
    return extractBalanced(schemaBlock, i, "{", "}");
  }
  if (/[A-Za-z_]/.test(ch)) {
    let j = i;
    let depth = 0;
    let inString = false;
    let quote = null;
    for (; j < schemaBlock.length; j += 1) {
      const current = schemaBlock[j];
      const prev = schemaBlock[j - 1];
      if (inString) {
        if (current === quote && prev !== "\\") {
          inString = false;
          quote = null;
        }
        continue;
      }
      if (current === "'" || current === '"' || current === "`") {
        inString = true;
        quote = current;
        continue;
      }
      if (current === "(" || current === "{" || current === "[") {
        depth += 1;
      } else if (current === ")" || current === "}" || current === "]") {
        depth -= 1;
      } else if ((current === "," || current === "\n") && depth <= 0) {
        break;
      }
    }
    return schemaBlock.slice(i, j).trim().replace(/,$/, "");
  }
  return null;
}

function parseResponseExpression(schemaBlock) {
  const responseExpression = parseSchemaEntryExpression(schemaBlock, "response");
  if (!responseExpression) return null;
  if (!(responseExpression.startsWith("{") && responseExpression.endsWith("}"))) {
    return responseExpression;
  }
  const preferredCodes = ["200", "201", "202", "204"];
  const entries = splitTopLevelProperties(responseExpression.slice(1, -1));
  for (const code of preferredCodes) {
    const entry = entries.find((prop) => prop.trim().startsWith(`${code}:`));
    if (!entry) continue;
    const value = entry.slice(entry.indexOf(":") + 1).trim();
    if (!value) continue;
    if (value.startsWith("{")) {
      return value;
    }
    return value;
  }
  return null;
}

function parseTags(schemaBlock) {
  const tagsMatch = schemaBlock.match(/tags\s*:\s*\[([^\]]*)\]/m);
  if (!tagsMatch) return [];
  return tagsMatch[1]
    .split(",")
    .map((tag) => tag.trim().replace(/^["'`]|["'`]$/g, ""))
    .filter(Boolean);
}

function joinRoutePath(basePath, localPath) {
  const full = `${basePath === "/" ? "" : basePath}${localPath === "/" ? "" : localPath}` || "/";
  return normalizeOpenApiPath(full.startsWith("/") ? full : `/${full}`);
}

function inferBasePath(apiRoutesRoot, filePath) {
  const relativeDir = path.relative(apiRoutesRoot, path.dirname(filePath)).replaceAll(path.sep, "/");
  if (!relativeDir || relativeDir === ".") return "/";
  return `/${relativeDir}`;
}

function inferFastifyAuthHint(routePath, optionsArg) {
  if (routePath === "/auth/login" || routePath === "/auth/register") return "public";
  if (/preHandler\s*:/.test(optionsArg)) return "secured";
  return "secured";
}

export const fastifyExtractor = {
  id: "api.fastify",
  track: "api",
  detect(context) {
    const routeFiles = findPrimaryImportFiles(context.paths, (filePath) => /src\/routes\/api\/.+\.(ts|js|mjs|cjs)$/i.test(filePath));
    const packageJsonFiles = findPrimaryImportFiles(context.paths, (filePath) => /package\.json$/i.test(filePath));
    const hasFastifyDependency = packageJsonFiles.some((filePath) => /"fastify"\s*:/.test(context.helpers.readTextIfExists(filePath) || ""));
    return {
      score: routeFiles.length > 0 && hasFastifyDependency ? 86 : 0,
      reasons: routeFiles.length > 0 && hasFastifyDependency ? ["Found Fastify route plugins and Fastify package dependency"] : []
    };
  },
  extract(context) {
    const apiRoutesRoot = findPrimaryImportFiles(context.paths, (filePath) => /src\/routes\/api\/index\.(ts|js|mjs|cjs)$/i.test(filePath))[0]
      ? path.join(path.dirname(findPrimaryImportFiles(context.paths, (filePath) => /src\/routes\/api\/index\.(ts|js|mjs|cjs)$/i.test(filePath))[0]))
      : null;
    if (!apiRoutesRoot) {
      return { findings: [], candidates: { capabilities: [], routes: [], stacks: [] } };
    }

    const routeFiles = findPrimaryImportFiles(context.paths, (filePath) => /src\/routes\/api\/.+\.(ts|js|mjs|cjs)$/i.test(filePath))
      .filter((filePath) => !/\/autohooks\.(ts|js|mjs|cjs)$/i.test(filePath));
    const schemaFiles = findPrimaryImportFiles(context.paths, (filePath) => /src\/schemas\/.+\.(ts|js|mjs|cjs)$/i.test(filePath));
    const namedSchemas = parseNamedTypeboxSchemas(schemaFiles, context.helpers.readTextIfExists);

    const routes = [];
    for (const filePath of routeFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const basePath = inferBasePath(apiRoutesRoot, filePath);
      const routeCalls = findCallArguments(text, /fastify\.(get|post|put|patch|delete)\s*\(/g);
      for (const routeCall of routeCalls) {
        const [pathArg, optionsArg = "", handlerArg = ""] = routeCall.args;
        if (!pathArg) continue;
        const localPath = pathArg.trim().replace(/^["'`]|["'`]$/g, "") || "/";
        const fullPath = joinRoutePath(basePath, localPath);
        const schemaBlock = parseSchemaBlock(optionsArg);
        const tags = schemaBlock ? parseTags(schemaBlock) : [];
        const queryExpression = schemaBlock ? parseSchemaEntryExpression(schemaBlock, "querystring") : null;
        const bodyExpression = schemaBlock ? parseSchemaEntryExpression(schemaBlock, "body") : null;
        const paramsExpression = schemaBlock ? parseSchemaEntryExpression(schemaBlock, "params") : null;
        const responseExpression = schemaBlock ? parseResponseExpression(schemaBlock) : null;
        const operation = {
          method: routeCall.method,
          path: fullPath,
          tags
        };
        routes.push({
          file: filePath,
          method: routeCall.method,
          path: fullPath,
          id_hint: inferApiCapabilityIdFromOperation(operation),
          label: titleCase(inferApiCapabilityIdFromOperation(operation).replace(/^cap_/, "")),
          path_params: parseSchemaExpressionFields(paramsExpression, namedSchemas).map((name) => ({ name, required: true, type: null })),
          query_params: parseSchemaExpressionFields(queryExpression, namedSchemas).map((name) => ({ name, required: false, type: null })),
          input_fields: parseSchemaExpressionFields(bodyExpression, namedSchemas),
          output_fields: parseSchemaExpressionFields(responseExpression, namedSchemas),
          auth_hint: inferFastifyAuthHint(fullPath, optionsArg),
          entity_id: inferApiEntityIdFromPath(fullPath, { tags }),
          tags,
          provenance: `${relativeTo(context.paths.repoRoot, filePath)}#${routeCall.method} ${fullPath}`
        });
      }
    }

    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "fastify_routes",
        files: [...new Set(routes.map((route) => relativeTo(context.paths.repoRoot, route.file)))],
        route_count: routes.length
      });
      candidates.capabilities.push(...routes.map((route) => makeCandidateRecord({
        kind: "capability",
        idHint: route.id_hint,
        label: route.label,
        confidence: "high",
        sourceKind: "route_code",
        provenance: route.provenance,
        endpoint: { method: route.method, path: route.path },
        path_params: route.path_params,
        query_params: route.query_params,
        header_params: [],
        input_fields: route.input_fields,
        output_fields: route.output_fields,
        auth_hint: route.auth_hint,
        entity_id: route.entity_id,
        tags: route.tags,
        track: "api"
      })));
      candidates.routes.push(...routes.map((route) => ({
        path: route.path,
        method: route.method,
        confidence: "high",
        source_kind: "route_code",
        provenance: route.provenance
      })));
      candidates.stacks.push("fastify");
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
