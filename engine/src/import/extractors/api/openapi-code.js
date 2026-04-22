import path from "node:path";

import {
  dedupeCandidateRecords,
  findImportFiles,
  inferApiCapabilityIdFromOperation,
  inferApiEntityIdFromPath,
  makeCandidateRecord,
  normalizeOpenApiPath,
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

function parseZodObjectSchemaFields(schemaText) {
  const schemaFields = new Map();
  for (const match of schemaText.matchAll(/export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*z\s*\.\s*object\s*\([^)]*?\.shape\)\s*\.pick\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    const schemaName = match[1];
    const fields = [];
    for (const prop of splitTopLevelProperties(match[2])) {
      const propMatch = prop.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (propMatch) fields.push(propMatch[1]);
    }
    schemaFields.set(schemaName, [...new Set(fields)].sort());
  }
  for (const match of schemaText.matchAll(/export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*z\s*\.\s*object\s*\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    const schemaName = match[1];
    const fields = [];
    for (const prop of splitTopLevelProperties(match[2])) {
      const propMatch = prop.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (propMatch) fields.push(propMatch[1]);
    }
    schemaFields.set(schemaName, [...new Set(fields)].sort());
  }
  return schemaFields;
}

function extractRequestSchemaRefs(block) {
  return {
    body: block.match(/request\s*:\s*\{[\s\S]*?body\s*:\s*\{[\s\S]*?schema\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/m)?.[1] || null,
    params: block.match(/request\s*:\s*\{[\s\S]*?params\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/m)?.[1] || null,
    query: block.match(/request\s*:\s*\{[\s\S]*?query\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/m)?.[1] || null,
    headers: block.match(/request\s*:\s*\{[\s\S]*?headers\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/m)?.[1] || null
  };
}

function extractSecurity(block) {
  return /security\s*:\s*\[\s*\{\s*bearerAuth\s*:\s*\[\s*\]\s*\}\s*\]/m.test(block) ? ["bearerAuth"] : [];
}

function extractTags(block) {
  const match = block.match(/tags\s*:\s*\[([\s\S]*?)\]/m);
  if (!match) return [];
  return [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((entry) => entry[1]);
}

function singularStemFromSchemaRef(schemaRef) {
  return String(schemaRef || "")
    .replace(/(?:DataSchema|ResponseDataSchema|Schema)$/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function inferOutputFieldsFromExpression(expression, schemaFields, entry) {
  const trimmed = String(expression || "").trim();
  if (!trimmed) return [];
  const simpleRef = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (simpleRef) {
    return schemaFields.get(simpleRef[1]) || [];
  }
  const arrayRef = trimmed.match(/^z\s*\.\s*array\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/);
  if (arrayRef) {
    const base = singularStemFromSchemaRef(arrayRef[1]).replace(/_schema$/, "");
    return [pluralizeCandidateTerm(base)];
  }
  return [];
}

function extractSuccessResponseMeta(block, schemaFields, entry) {
  const successBlockMatch = block.match(/responses\s*:\s*\{[\s\S]*?(20[0-9])\s*:\s*\{([\s\S]*?)\n\s*\}\s*(?:,|\n\s*\})/m);
  if (!successBlockMatch) {
    return { responseSchema: null, outputFields: [] };
  }
  const successBlock = successBlockMatch[2];
  const extendMatch = successBlock.match(/schema\s*:\s*SuccessResponseSchema\s*\.extend\(\s*\{([\s\S]*?)\}\s*\)/m);
  if (extendMatch) {
    const dataMatch = extendMatch[1].match(/data\s*:\s*([^,\n}]+)/m);
    const responseExpr = dataMatch ? dataMatch[1].trim() : null;
    return {
      responseSchema: responseExpr,
      outputFields: responseExpr ? inferOutputFieldsFromExpression(responseExpr, schemaFields, entry) : schemaFields.get("SuccessResponseSchema") || []
    };
  }
  const schemaRef = successBlock.match(/schema\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/m)?.[1] || null;
  return {
    responseSchema: schemaRef,
    outputFields: schemaRef ? schemaFields.get(schemaRef) || [] : []
  };
}

function parseOpenApiRegisterPaths(text, schemaFields) {
  const entries = [];
  for (const match of text.matchAll(/registry\.registerPath\(\s*\{([\s\S]*?)\n\}\s*\);/g)) {
    const block = match[1];
    const methodMatch = block.match(/method\s*:\s*["'`]([A-Za-z]+)["'`]/);
    const pathMatch = block.match(/path\s*:\s*["'`]([^"'`]+)["'`]/);
    if (!methodMatch || !pathMatch) continue;
    const summaryMatch = block.match(/summary\s*:\s*["'`]([^"'`]+)["'`]/);
    const requestSchemas = extractRequestSchemaRefs(block);
    const securitySchemes = extractSecurity(block);
    const tags = extractTags(block);
    const entry = {
      method: methodMatch[1].toUpperCase(),
      path: pathMatch[1],
      summary: summaryMatch ? summaryMatch[1] : null,
      tags,
      requestSchemas,
      security_schemes: securitySchemes
    };
    const responseMeta = extractSuccessResponseMeta(block, schemaFields, entry);
    entries.push({
      ...entry,
      requestSchema: requestSchemas.body,
      responseSchema: responseMeta.responseSchema,
      input_fields: requestSchemas.body ? schemaFields.get(requestSchemas.body) || [] : [],
      query_params: requestSchemas.query ? (schemaFields.get(requestSchemas.query) || []).map((name) => ({ name, required: false, type: null })) : [],
      path_params: requestSchemas.params
        ? (schemaFields.get(requestSchemas.params) || []).map((name) => ({ name, required: true, type: null }))
        : [...pathMatch[1].matchAll(/\{([^}]+)\}/g)].map((param) => ({ name: param[1], required: true, type: null })),
      header_params: requestSchemas.headers ? (schemaFields.get(requestSchemas.headers) || []).map((name) => ({ name, required: false, type: null })) : [],
      output_fields: responseMeta.outputFields,
      entity_id: inferApiEntityIdFromPath(pathMatch[1], { tags, summary: summaryMatch ? summaryMatch[1] : null })
    });
  }
  return entries;
}

export const openApiCodeExtractor = {
  id: "api.openapi-code",
  track: "api",
  detect(context) {
    const openApiFiles = findImportFiles(context.paths, (filePath) => /src\/docs\/openapi\.(ts|js|mjs|cjs)$/i.test(filePath));
    return {
      score: openApiFiles.length > 0 ? 92 : 0,
      reasons: openApiFiles.length > 0 ? ["Found code-generated OpenAPI source"] : []
    };
  },
  extract(context) {
    const openApiFiles = findImportFiles(context.paths, (filePath) => /src\/docs\/openapi\.(ts|js|mjs|cjs)$/i.test(filePath));
    const schemaFile = findImportFiles(context.paths, (filePath) => /src\/docs\/openapi-schemas\.(ts|js|mjs|cjs)$/i.test(filePath))[0];
    const schemaFields = schemaFile ? parseZodObjectSchemaFields(context.helpers.readTextIfExists(schemaFile) || "") : new Map();
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    for (const filePath of openApiFiles) {
      const provenanceBase = relativeTo(context.paths.repoRoot, filePath);
      const parsed = parseOpenApiRegisterPaths(context.helpers.readTextIfExists(filePath) || "", schemaFields);
      findings.push({
        kind: "openapi_code",
        file: provenanceBase,
        capability_count: parsed.length
      });
      candidates.capabilities.push(...parsed.map((entry) => makeCandidateRecord({
        kind: "capability",
        idHint: inferApiCapabilityIdFromOperation(entry),
        label: entry.summary || titleCase(inferApiCapabilityIdFromOperation(entry).replace(/^cap_/, "")),
        confidence: "high",
        sourceKind: "openapi",
        provenance: `${provenanceBase}#${entry.method} ${entry.path}`,
        endpoint: { method: entry.method, path: entry.path },
        path_params: entry.path_params || [],
        query_params: entry.query_params || [],
        header_params: entry.header_params || [],
        input_fields: entry.input_fields,
        output_fields: entry.output_fields,
        security_schemes: entry.security_schemes,
        auth_hint: entry.security_schemes.length > 0 ? "secured" : "public",
        entity_id: entry.entity_id,
        tags: entry.tags,
        track: "api"
      })));
      candidates.routes.push(...parsed.map((entry) => ({
        path: normalizeOpenApiPath(entry.path),
        method: entry.method,
        confidence: "high",
        source_kind: "openapi",
        provenance: `${provenanceBase}#${entry.method} ${entry.path}`
      })));
      candidates.stacks.push("openapi_code");
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
