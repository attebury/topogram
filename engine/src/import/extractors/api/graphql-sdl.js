import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  pluralizeCandidateTerm,
  readTextIfExists,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function extractTemplateTypeDefs(text) {
  const blocks = [];
  for (const match of text.matchAll(/(?:typeDefs|schema)\s*=\s*(?:\/\*[\s\S]*?\*\/\s*)?`([\s\S]*?)`/g)) {
    blocks.push(match[1]);
  }
  for (const match of text.matchAll(/\bgql\s*`([\s\S]*?)`/g)) {
    blocks.push(match[1]);
  }
  return blocks;
}

function splitTopLevelComma(value) {
  const items = [];
  let current = "";
  let depth = 0;
  for (const char of String(value || "")) {
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      if (current.trim()) items.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function splitGraphqlFieldEntries(body) {
  const entries = [];
  let current = "";
  let parenDepth = 0;
  for (const rawLine of String(body || "").split("\n")) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    current = current ? `${current} ${line}` : line;
    parenDepth += (line.match(/\(/g) || []).length;
    parenDepth -= (line.match(/\)/g) || []).length;
    if (parenDepth <= 0) {
      entries.push(current.trim());
      current = "";
      parenDepth = 0;
    }
  }
  if (current.trim()) {
    entries.push(current.trim());
  }
  return entries;
}

function parseGraphqlSchemaBlocks(schemaText) {
  const blocks = new Map();
  for (const match of String(schemaText || "").matchAll(/\b(type|input|enum)\s+([A-Za-z_][A-Za-z0-9_]*)[^{]*\{([\s\S]*?)\}/g)) {
    const kind = match[1];
    const name = match[2];
    const body = match[3];
    blocks.set(name, {
      kind,
      name,
      entries: splitGraphqlFieldEntries(body)
    });
  }
  return blocks;
}

function parseGraphqlField(entry) {
  const compact = String(entry || "").replace(/\s+/g, " ").trim();
  const match = compact.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\((.*)\))?\s*:\s*(.+)$/);
  if (!match) return null;
  return {
    name: match[1],
    args: match[2] || "",
    type: match[3].trim()
  };
}

function unwrapGraphqlType(typeName) {
  return String(typeName || "").replace(/[!\[\]\s]/g, "");
}

function isGraphqlListType(typeName) {
  return /\[/.test(String(typeName || ""));
}

function flattenInputFields(typeName, inputTypes, seen = new Set()) {
  const baseType = unwrapGraphqlType(typeName);
  if (!baseType) return [];
  if (seen.has(baseType)) return [];
  const block = inputTypes.get(baseType);
  if (!block) return [];
  seen.add(baseType);
  const fields = [];
  for (const entry of block.entries) {
    const field = parseGraphqlField(entry);
    if (!field) continue;
    const nested = flattenInputFields(field.type, inputTypes, seen);
    if (nested.length > 0) {
      fields.push(...nested);
    } else {
      fields.push(field.name);
    }
  }
  seen.delete(baseType);
  return [...new Set(fields)].sort();
}

function fieldsForOutputType(typeName, outputTypes) {
  const baseType = unwrapGraphqlType(typeName);
  const block = outputTypes.get(baseType);
  if (!block) return [];
  return [...new Set(block.entries.map((entry) => parseGraphqlField(entry)?.name).filter(Boolean))].sort();
}

function inferEntityId(operationName, returnType) {
  const baseType = unwrapGraphqlType(returnType);
  if (baseType && !["String", "Int", "Float", "Boolean", "ID", "DateTime"].includes(baseType)) {
    return `entity_${idHintify(canonicalCandidateTerm(baseType))}`;
  }
  const name = String(operationName || "");
  const suffixMatch = name.match(/([A-Z][A-Za-z0-9_]*)$/);
  return `entity_${idHintify(canonicalCandidateTerm(suffixMatch ? suffixMatch[1] : name || "item"))}`;
}

function inferCapabilityId(operationName, returnType, rootType) {
  const entityStem = inferEntityId(operationName, returnType).replace(/^entity_/, "");
  const normalizedName = idHintify(operationName);
  if (/(signup|register)/i.test(operationName)) return `cap_register_${entityStem}`;
  if (/(signin|sign_in|login|authenticate)/i.test(normalizedName)) return `cap_sign_in_${entityStem}`;
  if (/(delete|remove)/i.test(operationName)) return `cap_delete_${entityStem}`;
  if (/(togglepublish|publish)/i.test(normalizedName)) return `cap_publish_${entityStem}`;
  if (/increment.*view.*count/i.test(normalizedName)) return `cap_update_${entityStem}_view_count`;
  if (/(create|add|new)/i.test(operationName)) return `cap_create_${entityStem}`;
  if (rootType === "Query" && (isGraphqlListType(returnType) || /^(all|list|feed|drafts)/i.test(operationName))) {
    return `cap_list_${pluralizeCandidateTerm(entityStem)}`;
  }
  if (rootType === "Query" && /(byid|get|find|detail)/i.test(operationName)) {
    return `cap_get_${entityStem}`;
  }
  if (rootType === "Mutation") {
    return `cap_update_${entityStem}`;
  }
  return `${rootType === "Mutation" ? "cap_update_" : "cap_get_"}${entityStem}_${normalizedName}`;
}

function inferTargetState(operationName, capabilityId) {
  if (/(signup|register)/i.test(operationName)) return "registered";
  if (/(signin|login|authenticate)/i.test(operationName)) return "authenticated";
  if (/(togglepublish|publish)/i.test(operationName)) return "published";
  if (/delete/i.test(operationName) || capabilityId.startsWith("cap_delete_")) return "deleted";
  return null;
}

function inferEndpointPath(context, graphqlFiles) {
  for (const filePath of graphqlFiles) {
    const text = readTextIfExists(filePath);
    if (!text) continue;
    const endpointMatch = text.match(/graphqlEndpoint\s*:\s*["'`]([^"'`]+)["'`]/);
    if (endpointMatch) {
      return endpointMatch[1];
    }
  }
  const packageJsonPath = findPrimaryImportFiles(context.paths, (filePath) => /package\.json$/i.test(filePath))[0];
  const packageText = packageJsonPath ? readTextIfExists(packageJsonPath) : null;
  if (packageText && /graphql-yoga|apollo-server|@apollo\/server/.test(packageText)) {
    return "/graphql";
  }
  return "/graphql";
}

function extractGraphqlSchemaSources(context) {
  const files = findPrimaryImportFiles(
    context.paths,
    (filePath) =>
      /\/src\/.+\.(ts|tsx|js|jsx)$/i.test(filePath) ||
      /\/schema\.(graphql|gql)$/i.test(filePath) ||
      /\.(graphql|gql)$/i.test(filePath)
  ).filter((filePath) => !/\.test\./i.test(filePath));
  const schemas = [];
  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    if (/\.(graphql|gql)$/i.test(filePath)) {
      schemas.push({ file: filePath, schema: text });
      continue;
    }
    for (const schema of extractTemplateTypeDefs(text)) {
      schemas.push({ file: filePath, schema });
    }
  }
  return schemas;
}

export const graphQlSdlExtractor = {
  id: "api.graphql-sdl",
  track: "api",
  detect(context) {
    const schemaSources = extractGraphqlSchemaSources(context);
    const hasOperations = schemaSources.some(({ schema }) => /\btype\s+Query\b|\btype\s+Mutation\b/.test(schema));
    const packageJsonPath = findPrimaryImportFiles(context.paths, (filePath) => /package\.json$/i.test(filePath))[0];
    const packageText = packageJsonPath ? readTextIfExists(packageJsonPath) : "";
    const hasGraphqlRuntime = /graphql-yoga|graphql|apollo-server|@apollo\/server/.test(packageText || "");
    return {
      score: hasOperations ? (hasGraphqlRuntime ? 90 : 75) : 0,
      reasons: hasOperations ? ["Found GraphQL SDL with Query/Mutation operations"] : []
    };
  },
  extract(context) {
    const schemaSources = extractGraphqlSchemaSources(context);
    const endpointPath = inferEndpointPath(context, findPrimaryImportFiles(context.paths, (filePath) => /\/src\/.+\.(ts|tsx|js|jsx)$/i.test(filePath)));
    const mergedSchema = schemaSources.map(({ schema }) => schema).join("\n\n");
    const blocks = parseGraphqlSchemaBlocks(mergedSchema);
    const inputTypes = new Map([...blocks.entries()].filter(([, block]) => block.kind === "input"));
    const outputTypes = new Map([...blocks.entries()].filter(([, block]) => block.kind === "type"));
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    const queryBlock = blocks.get("Query");
    const mutationBlock = blocks.get("Mutation");

    const operations = [
      ...(queryBlock?.entries || []).map((entry) => ({ rootType: "Query", field: parseGraphqlField(entry), sourceFile: schemaSources[0]?.file || null })),
      ...(mutationBlock?.entries || []).map((entry) => ({ rootType: "Mutation", field: parseGraphqlField(entry), sourceFile: schemaSources[0]?.file || null }))
    ].filter((entry) => entry.field);

    for (const operation of operations) {
      const field = operation.field;
      const entityId = inferEntityId(field.name, field.type);
      const capabilityId = inferCapabilityId(field.name, field.type, operation.rootType);
      const inputFields = [];
      for (const arg of splitTopLevelComma(field.args)) {
        const argMatch = arg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
        if (!argMatch) continue;
        const nestedFields = flattenInputFields(argMatch[2], inputTypes);
        if (nestedFields.length > 0) {
          inputFields.push(...nestedFields);
        } else {
          inputFields.push(argMatch[1]);
        }
      }
      const outputFields = fieldsForOutputType(field.type, outputTypes);
      const method = operation.rootType === "Mutation" ? "POST" : "GET";
      const provenance = `${relativeTo(context.paths.repoRoot, operation.sourceFile || schemaSources[0]?.file || "")}#${operation.rootType}.${field.name}`;
      candidates.capabilities.push(
        makeCandidateRecord({
          kind: "capability",
          idHint: capabilityId,
          label: titleCase(capabilityId.replace(/^cap_/, "")),
          confidence: "high",
          sourceKind: "schema",
          provenance,
          endpoint: {
            method,
            path: endpointPath
          },
          path_params: [],
          query_params: [],
          header_params: [],
          input_fields: [...new Set(inputFields)].sort(),
          output_fields: outputFields,
          auth_hint: "public",
          entity_id: entityId,
          graphql_operation: {
            root_type: operation.rootType,
            field: field.name
          },
          target_state: inferTargetState(field.name, capabilityId),
          track: "api"
        })
      );
      candidates.routes.push({
        path: endpointPath,
        method,
        confidence: "high",
        source_kind: "schema",
        provenance
      });
    }

    if (operations.length > 0) {
      findings.push({
        kind: "graphql_operations",
        files: [...new Set(schemaSources.map(({ file }) => relativeTo(context.paths.repoRoot, file)))],
        operation_count: operations.length
      });
      candidates.stacks.push("graphql_sdl");
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
