import {
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  inferApiEntityIdFromPath,
  inferRouteCapabilityId,
  makeCandidateRecord,
  normalizeOpenApiPath,
  readTextIfExists,
  relativeTo,
  titleCase
} from "../../core/shared.js";

const JAVA_ANNOTATION_PATTERN = String.raw`@[\w.]+(?:\((?:[^()]|\([^)]*\))*\))?`;

function buildJavaFileIndex(paths) {
  const files = findPrimaryImportFiles(paths, (filePath) => /\.java$/i.test(filePath));
  return files.map((filePath) => ({
    filePath,
    relativePath: relativeTo(paths.repoRoot, filePath),
    text: readTextIfExists(filePath) || ""
  }));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function explicitHandlerHint(methodName, routePath, httpMethod) {
  void methodName;
  void routePath;
  void httpMethod;
  return null;
}

function parseRecordFields(recordText) {
  const ctorMatch = String(recordText || "").match(/record\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([\s\S]*?)\)\s*(?:implements[^{]+)?\{/);
  if (!ctorMatch) return [];
  return ctorMatch[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(new RegExp(`${JAVA_ANNOTATION_PATTERN}\\s*`, "g"), "").trim();
      const match = cleaned.match(/([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
      return match ? { type: match[1], name: match[2] } : null;
    })
    .filter(Boolean);
}

function parseClassFields(classText) {
  return [...String(classText || "").matchAll(new RegExp(`((?:\\s*${JAVA_ANNOTATION_PATTERN}\\s*)*)\\s*private\\s+([A-Za-z0-9_<>\\[\\]\\?\\.]+)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*;`, "g"))]
    .map((entry) => ({
      annotations: entry[1] || "",
      type: entry[2],
      name: entry[3]
    }));
}

function findJavaTypeBlock(typeName, files, preferredFile = null) {
  const bare = String(typeName || "").split(".").pop();
  if (!bare) return null;
  const patterns = [
    new RegExp(`(?:public\\s+)?record\\s+${escapeRegExp(bare)}\\b[\\s\\S]{0,2400}?\\n\\}`, "m"),
    new RegExp(`(?:public\\s+)?class\\s+${escapeRegExp(bare)}\\b[\\s\\S]{0,3600}?\\n\\}`, "m"),
    new RegExp(`(?:public\\s+)?interface\\s+${escapeRegExp(bare)}\\b[\\s\\S]{0,2400}?\\n\\}`, "m")
  ];
  const orderedFiles = preferredFile
    ? [...files.filter((file) => file.filePath === preferredFile), ...files.filter((file) => file.filePath !== preferredFile)]
    : files;
  for (const file of orderedFiles) {
    for (const pattern of patterns) {
      const match = file.text.match(pattern);
      if (match) {
        return { filePath: file.filePath, text: match[0] };
      }
    }
  }
  return null;
}

function flattenFieldsFromType(typeName, files, seen = new Set(), preferredFile = null) {
  const bare = String(typeName || "").split(".").pop();
  const key = `${preferredFile || ""}:${bare}`;
  if (!bare || seen.has(key)) return [];
  seen.add(key);
  const block = findJavaTypeBlock(typeName, files, preferredFile);
  if (!block) return [];
  const fields = [];
  const recordFields = parseRecordFields(block.text);
  if (recordFields.length > 0) {
    for (const field of recordFields) {
      const nested = flattenFieldsFromType(field.type, files, seen, block.filePath);
      if (nested.length > 0 && ["body", "data", "input", "model", "payload", "record", "request"].includes(field.name.toLowerCase())) {
        fields.push(...nested);
      } else {
        fields.push(field.name);
      }
    }
    return [...new Set(fields)];
  }
  for (const field of parseClassFields(block.text)) {
    if (/static\s+final/i.test(field.annotations || "")) continue;
    fields.push(field.name);
  }
  return [...new Set(fields)];
}

function flattenOutputFieldsFromType(typeName, files, preferredFile = null) {
  const block = findJavaTypeBlock(typeName, files, preferredFile);
  if (!block) return [];
  const recordFields = parseRecordFields(block.text);
  if (recordFields.length > 0) return recordFields.map((field) => field.name);
  return parseClassFields(block.text).map((field) => field.name);
}

function parseRequestParams(parameters) {
  return [...String(parameters || "").matchAll(/@RequestParam(?:\(([^)]*)\))?\s+(?:@[A-Za-z_][A-Za-z0-9_.]*(?:\([^)]*\))?\s+)*([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({
      name: entry[3],
      required: !/required\s*=\s*false/.test(entry[1] || ""),
      type: entry[2] || null
    }));
}

function parsePathParams(parameters) {
  return [...String(parameters || "").matchAll(/@PathVariable(?:\("([^"]+)"\))?\s+(?:@[A-Za-z_][A-Za-z0-9_.]*(?:\([^)]*\))?\s+)*([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({
      name: entry[1] || entry[3],
      required: true,
      type: entry[2] || null
    }));
}

function parseHeaderParams(parameters) {
  return [...String(parameters || "").matchAll(/@RequestHeader(?:\(([^)]*)\))?\s+(?:@[A-Za-z_][A-Za-z0-9_.]*(?:\([^)]*\))?\s+)*([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({
      name: entry[3],
      required: !/required\s*=\s*false/.test(entry[1] || ""),
      type: entry[2] || null
    }));
}

function parseBodyType(parameters) {
  const match = String(parameters || "").match(/@RequestBody\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : null;
}

function normalizeJoinedPath(basePath, childPath = "") {
  return normalizeOpenApiPath(`/${[String(basePath || "").replace(/^\/+/, ""), String(childPath || "").replace(/^\/+/, "")].filter(Boolean).join("/")}`);
}

function inferAuthHint(pathValue, methodName, parameters = "", annotations = "") {
  if (/@PreAuthorize/.test(annotations) || /AuthenticationPrincipal|CurrentUser/.test(parameters) || /RequestHeader\([^)]*Authorization/.test(parameters)) return "secured";
  if (/\/(login|signin|sign-in|auth)$/.test(pathValue)) return "public";
  if (/\/(register|signup)$/.test(pathValue) || (pathValue === "/users" && /create|register|signup/i.test(methodName))) return "public";
  return "unknown";
}

function inferOutputFieldsFromBody(methodBody, returnType, files, preferredFile = null) {
  const keys = [...String(methodBody || "").matchAll(/put\("([^"]+)"/g)].map((entry) => entry[1]);
  if (keys.length > 0) return [...new Set(keys)];
  const typeFields = flattenOutputFieldsFromType(returnType, files, preferredFile);
  if (typeFields.length > 0) return typeFields;
  return [];
}

function parseOperationInterfaces(files, repoRoot) {
  const operationFiles = files.filter((file) => /\/api\/operation\/.+Operations\.java$/.test(file.relativePath));
  const routes = [];
  for (const file of operationFiles) {
    for (const match of file.text.matchAll(/@((?:Get|Post|Put|Patch|Delete)Exchange)\("([^"]+)"\)\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)\(([\s\S]*?)\);/g)) {
      const [, exchangeType, routePathRaw, returnType, methodName, parameters] = match;
      const method = exchangeType.replace("Exchange", "").toUpperCase();
      const pathValue = normalizeOpenApiPath(routePathRaw);
      const bodyType = parseBodyType(parameters);
      routes.push({
        method,
        path: pathValue,
        handler_hint: explicitHandlerHint(methodName, pathValue, method),
        controller: file.relativePath.split("/").pop()?.replace(/\.java$/, "") || "SpringOperation",
        action: methodName,
        auth_hint: inferAuthHint(pathValue, methodName, parameters, ""),
        path_params: parsePathParams(parameters),
        query_params: parseRequestParams(parameters),
        header_params: parseHeaderParams(parameters),
        input_fields: bodyType ? flattenFieldsFromType(bodyType, files, new Set(), file.filePath) : [],
        output_fields: flattenOutputFieldsFromType(returnType, files, file.filePath),
        provenance: `${relativeTo(repoRoot, file.filePath)}#${method} ${pathValue}`
      });
    }
  }
  return routes;
}

function parseSpringMvcRoutes(files, repoRoot) {
  const springFiles = files.filter((file) => /@(RestController|Controller)\b/.test(file.text));
  const routes = [];
  const methodPattern = new RegExp(`((?:\\s*${JAVA_ANNOTATION_PATTERN}\\s*)+)\\s*(?:public\\s+)?(?:default\\s+)?([A-Za-z0-9_<>\\[\\]\\?., ]+)\\s+([A-Za-z_][A-Za-z0-9_]*)\\(([\\s\\S]*?)\\)\\s*(\\{|;)`, "g");
  for (const file of springFiles) {
    const classMapping = file.text.match(/@RequestMapping\(([^)]*)\)/);
    const basePath = classMapping?.[1].match(/path\s*=\s*"([^"]+)"|"([^"]+)"/)?.[1] || classMapping?.[1].match(/path\s*=\s*"([^"]+)"|"([^"]+)"/)?.[2] || "";
    for (const match of file.text.matchAll(methodPattern)) {
      const [, annotations, returnTypeRaw, methodName, parameters, terminator] = match;
      const mappingMatch = annotations.match(/@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\(([^)]*)\)|@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\b/g);
      if (!mappingMatch) continue;
      let method = null;
      let childPath = "";
      let rawArgs = "";
      const first = mappingMatch[0];
      const detailed = first.match(/@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\(([^)]*)\)/);
      if (detailed) {
        const mappingType = detailed[1];
        rawArgs = detailed[2] || "";
        method = mappingType === "RequestMapping"
          ? (rawArgs.match(/RequestMethod\.([A-Z]+)/)?.[1] || rawArgs.match(/method\s*=\s*([A-Z]+)/)?.[1] || null)
          : mappingType.replace("Mapping", "").toUpperCase();
        childPath = rawArgs.match(/path\s*=\s*"([^"]+)"|"([^"]+)"/)?.[1] || rawArgs.match(/path\s*=\s*"([^"]+)"|"([^"]+)"/)?.[2] || "";
      } else {
        const simple = first.match(/@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\b/);
        if (simple) method = simple[1].replace("Mapping", "").toUpperCase();
      }
      if (!method) continue;
      const pathValue = normalizeJoinedPath(basePath, childPath);
      const bodyType = parseBodyType(parameters);
      const returnType = String(returnTypeRaw || "").trim().replace(/^CompletableFuture\s*</, "").replace(/^ResponseEntity\s*</, "").replace(/>\s*$/, "").replace(/>\s*$/, "").trim();
      const bodyStart = match.index + match[0].length;
      const nextChunk = terminator === "{" ? file.text.slice(bodyStart, bodyStart + 1600) : "";
      routes.push({
        method,
        path: pathValue,
        handler_hint: explicitHandlerHint(methodName, pathValue, method),
        controller: file.relativePath.split("/").pop()?.replace(/\.java$/, "") || "SpringController",
        action: methodName,
        auth_hint: inferAuthHint(pathValue, methodName, parameters, annotations),
        path_params: parsePathParams(parameters),
        query_params: parseRequestParams(parameters),
        header_params: parseHeaderParams(parameters),
        input_fields: bodyType ? flattenFieldsFromType(bodyType, files, new Set(), file.filePath) : [],
        output_fields: inferOutputFieldsFromBody(nextChunk, returnType, files, file.filePath),
        provenance: `${relativeTo(repoRoot, file.filePath)}#${method} ${pathValue}`
      });
    }
  }
  return routes;
}

export const springWebExtractor = {
  id: "api.spring-web",
  track: "api",
  detect(context) {
    const javaFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.java$/i.test(filePath));
    const springCount = javaFiles.filter((filePath) => /@(RestController|Controller)|@(?:Get|Post|Put|Patch|Delete)Exchange|@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)|@RequestMapping/.test(readTextIfExists(filePath) || "")).length;
    return {
      score: springCount > 0 ? 90 : 0,
      reasons: springCount > 0 ? ["Found Spring web contracts or controllers"] : []
    };
  },
  extract(context) {
    const javaFiles = buildJavaFileIndex(context.paths);
    const routes = [...parseOperationInterfaces(javaFiles, context.paths.repoRoot), ...parseSpringMvcRoutes(javaFiles, context.paths.repoRoot)];
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "spring_web",
        route_count: routes.length,
        files: [...new Set(routes.map((route) => route.provenance.split("#")[0]))]
      });
    }
    candidates.capabilities.push(...routes.map((route) => makeCandidateRecord({
      kind: "capability",
      idHint: inferRouteCapabilityId(route),
      label: route.handler_hint ? titleCase(route.handler_hint) : `${route.method} ${route.path}`,
      confidence: "high",
      sourceKind: "route_code",
      provenance: route.provenance,
      endpoint: { method: route.method, path: route.path },
      path_params: route.path_params,
      query_params: route.query_params,
      header_params: route.header_params,
      input_fields: route.input_fields,
      output_fields: route.output_fields,
      auth_hint: route.auth_hint,
      entity_id: route.handler_hint === "sign_in_account" ? "entity_account" : inferApiEntityIdFromPath(route.path),
      track: "api"
    })));
    candidates.routes.push(...routes.map((route) => ({
      path: route.path,
      method: route.method,
      confidence: "high",
      source_kind: "route_code",
      provenance: route.provenance
    })));
    candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(
      candidates.routes.map((route) => ({ ...route, id_hint: `${route.method}_${route.path}` })),
      (record) => `${record.method}:${record.path}:${record.source_kind}`
    ).map(({ id_hint, ...route }) => route);
    candidates.stacks = routes.length > 0 ? ["spring"] : [];
    return { findings, candidates };
  }
};
