import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  pluralizeCandidateTerm,
  readTextIfExists,
  relativeTo,
  titleCase
} from "../../core/shared.js";
import path from "node:path";

function stripComments(text) {
  return String(text || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function findClassBlocks(text) {
  const blocks = [];
  const source = String(text || "");
  let index = 0;
  while (index < source.length) {
    const classIndex = source.indexOf("class ", index);
    if (classIndex === -1) break;
    const headerStart = source.lastIndexOf("@", classIndex);
    const scanStart = headerStart >= 0 && source.slice(headerStart, classIndex).includes("@") ? headerStart : classIndex;
    const headerMatch = source.slice(classIndex).match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (!headerMatch) {
      index = classIndex + 5;
      continue;
    }
    const name = headerMatch[1];
    const braceIndex = source.indexOf("{", classIndex);
    if (braceIndex === -1) break;
    let depth = 1;
    let end = braceIndex + 1;
    while (end < source.length && depth > 0) {
      const char = source[end];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      end += 1;
    }
    blocks.push({
      text: source.slice(scanStart, end),
      header: source.slice(scanStart, braceIndex),
      body: source.slice(braceIndex + 1, end - 1),
      name
    });
    index = end;
  }
  return blocks;
}

function extractBalancedSegment(source, openIndex, openChar = "(", closeChar = ")") {
  if (openIndex < 0 || source[openIndex] !== openChar) return null;
  let depth = 1;
  let index = openIndex + 1;
  let inString = false;
  let quote = null;
  while (index < source.length && depth > 0) {
    const char = source[index];
    const prev = source[index - 1];
    if (inString) {
      if (char === quote && prev !== "\\") {
        inString = false;
        quote = null;
      }
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = true;
      quote = char;
      index += 1;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) depth -= 1;
    index += 1;
  }
  return depth === 0 ? source.slice(openIndex + 1, index - 1) : null;
}

function findCallBodies(text, callPrefix) {
  const bodies = [];
  let start = 0;
  while (start < text.length) {
    const idx = text.indexOf(callPrefix, start);
    if (idx === -1) break;
    const openIndex = text.indexOf("(", idx + callPrefix.length - 1);
    if (openIndex === -1) break;
    const body = extractBalancedSegment(text, openIndex, "(", ")");
    if (body != null) {
      bodies.push(body);
      start = openIndex + body.length + 2;
    } else {
      start = idx + callPrefix.length;
    }
  }
  return bodies;
}

function extractReturnedObjectBody(segment) {
  const fieldsIdx = segment.indexOf("fields:");
  if (fieldsIdx === -1) return null;
  const objectStart = segment.indexOf("{", fieldsIdx);
  if (objectStart === -1) return null;
  return extractBalancedSegment(segment, objectStart, "{", "}");
}

function parseDecoratorClassFields(classBlock) {
  const fields = [];
  const body = stripComments(classBlock.body);
  const pattern = /@Field\s*\(([\s\S]*?)\)\s*([\r\n\s]*)?([A-Za-z_][A-Za-z0-9_]*)\??\s*:/g;
  for (const match of body.matchAll(pattern)) {
    const decoratorArgs = match[1] || "";
    const fieldName = match[3];
    let typeName = null;
    const arrowType = decoratorArgs.match(/=>\s*\[?\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (arrowType) typeName = arrowType[1];
    fields.push({
      name: fieldName,
      typeName
    });
  }
  return fields;
}

function parseNestTypes(files) {
  const inputTypes = new Map();
  const objectTypes = new Map();
  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    for (const classBlock of findClassBlocks(text)) {
      if (/@InputType\s*\(/.test(classBlock.header)) {
        inputTypes.set(classBlock.name, parseDecoratorClassFields(classBlock));
      }
      if (/@ObjectType\s*\(/.test(classBlock.header)) {
        objectTypes.set(classBlock.name, parseDecoratorClassFields(classBlock));
      }
    }
  }
  return { inputTypes, objectTypes };
}

function parsePothosTypeName(fragment) {
  const typeMatch =
    String(fragment || "").match(/type\s*:\s*\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]/) ||
    String(fragment || "").match(/type\s*:\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/) ||
    String(fragment || "").match(/type\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/);
  return typeMatch ? typeMatch[1] : null;
}

function parsePothosTypes(files) {
  const inputTypes = new Map();
  const objectTypes = new Map();
  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    for (const body of findCallBodies(text, "builder.prismaObject")) {
      const nameMatch = body.match(/^\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/);
      if (!nameMatch) continue;
      const objectBody = extractReturnedObjectBody(body);
      if (!objectBody) continue;
      const fields = [];
      for (const match of objectBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*t\.(?:expose[A-Za-z_]+|relation)\s*\(/g)) {
        fields.push({ name: match[1], typeName: null });
      }
      objectTypes.set(nameMatch[1], fields);
    }
    for (const body of findCallBodies(text, "builder.inputType")) {
      const nameMatch = body.match(/^\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/);
      if (!nameMatch) continue;
      const objectBody = extractReturnedObjectBody(body);
      if (!objectBody) continue;
      const fields = [];
      for (const match of objectBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*t\.(string|int|id|field)\s*\(([\s\S]*?)\)/g)) {
        const fieldName = match[1];
        const fieldKind = match[2];
        const decoratorArgs = match[3] || "";
        fields.push({
          name: fieldName,
          typeName: fieldKind === "field" ? parsePothosTypeName(decoratorArgs) : null
        });
      }
      inputTypes.set(nameMatch[1], fields);
    }
  }
  return { inputTypes, objectTypes };
}

function parseNexusTypes(files) {
  const inputTypes = new Map();
  const objectTypes = new Map();
  const operationBlocks = [];
  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    for (const body of findCallBodies(text, "objectType")) {
      const nameMatch = body.match(/name\s*:\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/);
      if (!nameMatch) continue;
      const typeName = nameMatch[1];
      const definitionMatch = body.match(/definition\s*\(\s*t\s*\)\s*\{/);
      if (!definitionMatch) continue;
      const definitionStart = body.indexOf("{", definitionMatch.index);
      const definitionBody = extractBalancedSegment(body, definitionStart, "{", "}");
      if (!definitionBody) continue;
      if (typeName === "Query" || typeName === "Mutation") {
        operationBlocks.push({ typeName, body: definitionBody, filePath });
        continue;
      }
      const fields = [];
      for (const line of definitionBody.matchAll(/t(?:\.[A-Za-z_]+)*\.(?:field|string|int|boolean)\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"](?:\s*,\s*\{([\s\S]*?)\})?/g)) {
        const fieldName = line[1];
        const options = line[2] || "";
        const fieldType = parsePothosTypeName(options);
        fields.push({ name: fieldName, typeName: fieldType });
      }
      objectTypes.set(typeName, fields);
    }
    for (const body of findCallBodies(text, "inputObjectType")) {
      const nameMatch = body.match(/name\s*:\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/);
      if (!nameMatch) continue;
      const typeName = nameMatch[1];
      const definitionMatch = body.match(/definition\s*\(\s*t\s*\)\s*\{/);
      if (!definitionMatch) continue;
      const definitionStart = body.indexOf("{", definitionMatch.index);
      const definitionBody = extractBalancedSegment(body, definitionStart, "{", "}");
      if (!definitionBody) continue;
      const fields = [];
      for (const line of definitionBody.matchAll(/t(?:\.[A-Za-z_]+)*\.(field|string|int|boolean)\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"](?:\s*,\s*\{([\s\S]*?)\})?/g)) {
        const fieldKind = line[1];
        const fieldName = line[2];
        const options = line[3] || "";
        fields.push({
          name: fieldName,
          typeName: fieldKind === "field" ? parsePothosTypeName(options) : null
        });
      }
      inputTypes.set(typeName, fields);
    }
  }
  return { inputTypes, objectTypes, operationBlocks };
}

function flattenInputFields(typeName, inputTypes, seen = new Set()) {
  const normalized = String(typeName || "").replace(/[^\w]/g, "");
  if (!normalized || seen.has(normalized)) return [];
  const fields = inputTypes.get(normalized);
  if (!fields) return [];
  seen.add(normalized);
  const names = [];
  for (const field of fields) {
    const nested = flattenInputFields(field.typeName, inputTypes, seen);
    if (nested.length > 0) {
      names.push(...nested);
    } else {
      names.push(field.name);
    }
  }
  seen.delete(normalized);
  return [...new Set(names)].sort();
}

function outputFieldsForType(typeName, objectTypes) {
  const normalized = String(typeName || "").replace(/[^\w]/g, "");
  return [...new Set((objectTypes.get(normalized) || []).map((field) => field.name))].sort();
}

function inferEntityId(operationName, returnType) {
  const normalizedReturn = String(returnType || "").replace(/[^\w]/g, "");
  if (normalizedReturn && !["String", "Int", "Float", "Boolean", "ID", "Date"].includes(normalizedReturn)) {
    return `entity_${idHintify(canonicalCandidateTerm(normalizedReturn))}`;
  }
  const suffixMatch = String(operationName || "").match(/([A-Z][A-Za-z0-9_]*)$/);
  return `entity_${idHintify(canonicalCandidateTerm(suffixMatch ? suffixMatch[1] : operationName || "item"))}`;
}

function inferCapabilityId(operationName, returnType, rootType) {
  const entityStem = inferEntityId(operationName, returnType).replace(/^entity_/, "");
  const normalizedName = idHintify(operationName);
  if (rootType === "Query" && canonicalCandidateTerm(operationName) === canonicalCandidateTerm(entityStem)) {
    return `cap_get_${entityStem}`;
  }
  if (/(signup|register)/i.test(operationName)) return `cap_register_${entityStem}`;
  if (/(signin|sign_in|login|authenticate)/i.test(normalizedName)) return `cap_sign_in_${entityStem}`;
  if (/(delete|remove)/i.test(operationName)) return `cap_delete_${entityStem}`;
  if (/(togglepublish|publish)/i.test(normalizedName)) return `cap_publish_${entityStem}`;
  if (/increment.*view.*count/i.test(normalizedName)) return `cap_update_${entityStem}_view_count`;
  if (/(create|add|new)/i.test(operationName)) return `cap_create_${entityStem}`;
  if (rootType === "Query" && (/^(all|list|feed|drafts)/i.test(operationName) || /^\[/.test(String(returnType || "")))) {
    return `cap_list_${pluralizeCandidateTerm(entityStem)}`;
  }
  if (rootType === "Query" && /(byid|get|find|detail)/i.test(operationName)) {
    return `cap_get_${entityStem}`;
  }
  if (rootType === "Mutation") return `cap_update_${entityStem}`;
  return `${rootType === "Mutation" ? "cap_update_" : "cap_get_"}${entityStem}_${normalizedName}`;
}

function inferTargetState(operationName, capabilityId) {
  if (/(signup|register)/i.test(operationName)) return "registered";
  if (/(signin|login|authenticate)/i.test(operationName)) return "authenticated";
  if (/(togglepublish|publish)/i.test(operationName)) return "published";
  if (/delete/i.test(operationName) || capabilityId.startsWith("cap_delete_")) return "deleted";
  return null;
}

function inferGraphqlEndpoint(files) {
  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    const explicitPath = text.match(/\bpath\s*:\s*["'`]([^"'`]+)["'`]/);
    if (explicitPath) return explicitPath[1];
    if (/GraphQLModule\.forRoot/.test(text) || /createYoga|ApolloServer/.test(text)) {
      return "/graphql";
    }
  }
  return "/graphql";
}

function parseResolverOperations(filePath, text, inputTypes, objectTypes, endpointPath) {
  const operations = [];
  const source = String(text || "");
  const pattern = /@(Query|Mutation)\s*\(([\s\S]*?)\)\s*(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*[:{]/g;
  for (const match of source.matchAll(pattern)) {
    const rootType = match[1];
    const decoratorArgs = match[2] || "";
    const methodName = match[3];
    const params = match[4] || "";
    const returnTypeMatch = decoratorArgs.match(/=>\s*(\[[A-Za-z_][A-Za-z0-9_]*\]|[A-Za-z_][A-Za-z0-9_]*)/);
    const returnType = returnTypeMatch ? returnTypeMatch[1] : null;
    const inputFields = [];
    for (const paramMatch of params.matchAll(/@Args\(\s*['"`]([^'"`]+)['"`][^)]*\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^,\n)]+)/g)) {
      const argName = paramMatch[1];
      const paramType = paramMatch[3].trim();
      const nested = flattenInputFields(paramType, inputTypes);
      if (nested.length > 0) {
        inputFields.push(...nested);
      } else {
        inputFields.push(argName);
      }
    }
    const capabilityId = inferCapabilityId(methodName, returnType, rootType);
    operations.push({
      rootType,
      methodName,
      capabilityId,
      inputFields: [...new Set(inputFields)].sort(),
      outputFields: outputFieldsForType(returnType, objectTypes),
      entityId: inferEntityId(methodName, returnType),
      targetState: inferTargetState(methodName, capabilityId),
      provenance: `${relativeTo(path.dirname(path.dirname(filePath)), filePath).replace(/^src\//, `${relativeTo(path.dirname(path.dirname(filePath)), path.dirname(path.dirname(filePath)))}`)}`,
      filePath,
      endpointPath
    });
  }
  return operations;
}

function parsePothosOperations(filePath, text, inputTypes, objectTypes, endpointPath) {
  const operations = [];
  const source = String(text || "");
  for (const rootType of ["queryField", "mutationField"]) {
    for (const body of findCallBodies(source, `builder.${rootType}`)) {
      const nameMatch = body.match(/^\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/);
      if (!nameMatch) continue;
      const methodName = nameMatch[1];
      const prismaFieldMatch = body.match(/t\.prismaField\s*\(\s*\{/);
      if (!prismaFieldMatch) continue;
      const prismaFieldStart = body.indexOf("{", prismaFieldMatch.index);
      const prismaFieldBody = extractBalancedSegment(body, prismaFieldStart, "{", "}");
      if (!prismaFieldBody) continue;
      const returnTypeMatch =
        prismaFieldBody.match(/type\s*:\s*\[\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*\]/) ||
        prismaFieldBody.match(/type\s*:\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/) ||
        prismaFieldBody.match(/type\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/);
      const returnType = returnTypeMatch ? returnTypeMatch[0].includes("[") ? `[${returnTypeMatch[1]}]` : returnTypeMatch[1] : null;
      const inputFields = [];
      const argsMatch = prismaFieldBody.match(/args\s*:\s*\{/);
      if (argsMatch) {
        const argsStart = prismaFieldBody.indexOf("{", argsMatch.index);
        const argsBody = extractBalancedSegment(prismaFieldBody, argsStart, "{", "}");
        for (const argMatch of String(argsBody || "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*t\.arg(?:\.[A-Za-z_]+)?\s*\(([\s\S]*?)\)/g)) {
          const argName = argMatch[1];
          const argBody = argMatch[2] || "";
          const nestedType = parsePothosTypeName(argBody);
          const nestedFields = flattenInputFields(nestedType, inputTypes);
          if (nestedFields.length > 0) {
            inputFields.push(...nestedFields);
          } else {
            inputFields.push(argName);
          }
        }
      }
      const capabilityId = inferCapabilityId(methodName, returnType, rootType === "mutationField" ? "Mutation" : "Query");
      operations.push({
        rootType: rootType === "mutationField" ? "Mutation" : "Query",
        methodName,
        capabilityId,
        inputFields: [...new Set(inputFields)].sort(),
        outputFields: outputFieldsForType(returnType, objectTypes),
        entityId: inferEntityId(methodName, returnType),
        targetState: inferTargetState(methodName, capabilityId),
        filePath,
        endpointPath
      });
    }
  }
  return operations;
}

function parseNexusArgFields(argExpression, inputTypes) {
  const fields = [];
  for (const match of String(argExpression || "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]*?)(?:,|$)/g)) {
    const argName = match[1];
    const argBody = match[2] || "";
    const nestedType = parsePothosTypeName(argBody);
    const nestedFields = flattenInputFields(nestedType, inputTypes);
    if (nestedFields.length > 0) {
      fields.push(...nestedFields);
    } else {
      fields.push(argName);
    }
  }
  return [...new Set(fields)].sort();
}

function parseNexusOperations(operationBlocks, inputTypes, objectTypes, endpointPath) {
  const operations = [];
  for (const block of operationBlocks) {
    const rootType = block.typeName;
    const source = block.body;
    for (const match of source.matchAll(/t(?:\.[A-Za-z_]+)*\.field\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*,\s*\{/g)) {
      const methodName = match[1];
      const bodyStart = source.indexOf("{", match.index + match[0].lastIndexOf("{"));
      const fieldBody = extractBalancedSegment(source, bodyStart, "{", "}");
      if (!fieldBody) continue;
      const typeMatch = parsePothosTypeName(fieldBody);
      const argsMatch = fieldBody.match(/args\s*:\s*\{/);
      const inputFields = [];
      if (argsMatch) {
        const argsStart = fieldBody.indexOf("{", argsMatch.index);
        const argsBody = extractBalancedSegment(fieldBody, argsStart, "{", "}");
        inputFields.push(...parseNexusArgFields(argsBody, inputTypes));
      }
      const capabilityId = inferCapabilityId(methodName, typeMatch, rootType);
      operations.push({
        rootType,
        methodName,
        capabilityId,
        inputFields: [...new Set(inputFields)].sort(),
        outputFields: outputFieldsForType(typeMatch, objectTypes),
        entityId: inferEntityId(methodName, typeMatch),
        targetState: inferTargetState(methodName, capabilityId),
        filePath: block.filePath,
        endpointPath
      });
    }
  }
  return operations;
}

export const graphQlCodeFirstExtractor = {
  id: "api.graphql-code-first",
  track: "api",
  detect(context) {
    const files = findImportFiles(context.paths, (filePath) => /(\/src\/.+|\/pages\/api\/.+)\.(ts|tsx|js|jsx)$/i.test(filePath));
    const hasNestResolvers = files.some((filePath) => {
      const text = readTextIfExists(filePath) || "";
      return /@nestjs\/graphql/.test(text) && /@(Query|Mutation)\s*\(/.test(text);
    });
    const hasPothosSource = files.some((filePath) => {
      const text = readTextIfExists(filePath) || "";
      return /@pothos\/core/.test(text) && /builder\.(queryField|mutationField)\s*\(/.test(text);
    });
    const hasNexusSource = files.some((filePath) => {
      const text = readTextIfExists(filePath) || "";
      return /from ['"]nexus['"]/.test(text) && /objectType\s*\(\s*\{/.test(text) && /name\s*:\s*['"](Query|Mutation)['"]/.test(text);
    });
    return {
      score: hasNestResolvers ? 86 : hasPothosSource ? 84 : hasNexusSource ? 82 : 0,
      reasons: hasNestResolvers
        ? ["Found source-only Nest GraphQL resolvers"]
        : hasPothosSource
          ? ["Found source-only Pothos GraphQL schema definitions"]
          : hasNexusSource
            ? ["Found source-only Nexus GraphQL schema definitions"]
          : []
    };
  },
  extract(context) {
    const files = findImportFiles(context.paths, (filePath) => /(\/src\/.+|\/pages\/api\/.+)\.(ts|tsx|js|jsx)$/i.test(filePath)).filter((filePath) => !/\.test\./i.test(filePath));
    const nestTypes = parseNestTypes(files);
    const pothosTypes = parsePothosTypes(files);
    const nexusTypes = parseNexusTypes(files);
    const inputTypes = new Map([...nestTypes.inputTypes.entries(), ...pothosTypes.inputTypes.entries(), ...nexusTypes.inputTypes.entries()]);
    const objectTypes = new Map([...nestTypes.objectTypes.entries(), ...pothosTypes.objectTypes.entries(), ...nexusTypes.objectTypes.entries()]);
    const endpointPath = inferGraphqlEndpoint(files);
    const operations = [];
    for (const filePath of files) {
      const text = readTextIfExists(filePath) || "";
      if (/@nestjs\/graphql/.test(text) && /@(Query|Mutation)\s*\(/.test(text)) {
        operations.push(...parseResolverOperations(filePath, text, inputTypes, objectTypes, endpointPath));
      }
      if (/@pothos\/core/.test(text) && /builder\.(queryField|mutationField)\s*\(/.test(text)) {
        operations.push(...parsePothosOperations(filePath, text, inputTypes, objectTypes, endpointPath));
      }
    }
    operations.push(...parseNexusOperations(nexusTypes.operationBlocks, inputTypes, objectTypes, endpointPath));
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    for (const operation of operations) {
      const provenance = `${relativeTo(context.paths.repoRoot, operation.filePath)}#${operation.rootType}.${operation.methodName}`;
      candidates.capabilities.push(
        makeCandidateRecord({
          kind: "capability",
          idHint: operation.capabilityId,
          label: titleCase(operation.capabilityId.replace(/^cap_/, "")),
          confidence: "high",
          sourceKind: "route_code",
          provenance,
          endpoint: {
            method: operation.rootType === "Mutation" ? "POST" : "GET",
            path: endpointPath
          },
          path_params: [],
          query_params: [],
          header_params: [],
          input_fields: operation.inputFields,
          output_fields: operation.outputFields,
          auth_hint: "public",
          entity_id: operation.entityId,
          graphql_operation: {
            root_type: operation.rootType,
            field: operation.methodName
          },
          target_state: operation.targetState,
          track: "api"
        })
      );
      candidates.routes.push({
        path: endpointPath,
        method: operation.rootType === "Mutation" ? "POST" : "GET",
        confidence: "high",
        source_kind: "route_code",
        provenance
      });
    }
    if (operations.length > 0) {
      findings.push({
        kind: "graphql_code_first_operations",
        files: [...new Set(operations.map((entry) => relativeTo(context.paths.repoRoot, entry.filePath)))],
        operation_count: operations.length
      });
      candidates.stacks.push("graphql_code_first");
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
