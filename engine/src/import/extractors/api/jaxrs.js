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
      const cleaned = part.replace(/@[A-Za-z_][A-Za-z0-9_.]*(?:\((?:[^()]|\([^)]*\))*\))?\s*/g, "").trim();
      const match = cleaned.match(/([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
      return match ? { type: match[1], name: match[2] } : null;
    })
    .filter(Boolean);
}

function parseClassFields(classText) {
  return [...String(classText || "").matchAll(/((?:\s*@[\w.]+(?:\((?:[^()]|\([^)]*\))*\))?\s*)*)\s*private\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)]
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

function parsePathParams(parameters) {
  return [...String(parameters || "").matchAll(/@PathParam\("([^"]+)"\)\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({ name: entry[1] || entry[3], required: true, type: entry[2] || null }));
}

function parseQueryParams(parameters) {
  return [...String(parameters || "").matchAll(/@QueryParam\("([^"]+)"\)\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({ name: entry[1] || entry[3], required: false, type: entry[2] || null }));
}

function parseContextHeaders(parameters) {
  if (/SecurityContext/.test(parameters) || /HttpHeaders/.test(parameters)) {
    return [{ name: "authorization", required: false, type: "string" }];
  }
  return [];
}

function parseBodyType(parameters) {
  const parts = String(parameters || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (/@(PathParam|QueryParam|HeaderParam|BeanParam|Context)\b/.test(part)) continue;
    if (/\b(SecurityContext|UriInfo|ResourceContext|HttpServletRequest|HttpHeaders)\b/.test(part)) continue;
    const cleaned = part.replace(/@[A-Za-z_][A-Za-z0-9_.]*(?:\((?:[^()]|\([^)]*\))*\))?\s*/g, "").trim();
    const match = cleaned.match(/([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
    if (match) return match[1];
  }
  return null;
}

function normalizeJoinedPath(basePath, childPath = "") {
  return normalizeOpenApiPath(`/${[String(basePath || "").replace(/^\/+/, ""), String(childPath || "").replace(/^\/+/, "")].filter(Boolean).join("/")}`);
}

function inferAuthHint(pathValue, methodName, parameters = "", annotations = "") {
  if (/@Secured/.test(annotations) || /SecurityContext/.test(parameters)) return "secured";
  if (pathValue === "/users/login" || (pathValue === "/users" && /create|register|save/i.test(methodName)) || pathValue === "/tasks") {
    return "public";
  }
  return "unknown";
}

function buildSubresourceBaseMap(files) {
  const map = new Map();
  for (const file of files) {
    const classPath = file.text.match(/@Path\("([^"]+)"\)/)?.[1] || "";
    for (const match of file.text.matchAll(/@Path\("([^"]+)"\)\s+public\s+([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g)) {
      const [, childPath, returnType] = match;
      map.set(returnType, normalizeJoinedPath(classPath, childPath));
    }
  }
  return map;
}

function classLevelPath(text) {
  const classIndex = String(text || "").search(/\b(class|interface)\s+[A-Za-z_][A-Za-z0-9_]*/);
  if (classIndex < 0) return "";
  const head = String(text || "").slice(0, classIndex);
  const matches = [...head.matchAll(/@Path\("([^"]+)"\)/g)];
  return matches[matches.length - 1]?.[1] || "";
}

function parseJaxrsRoutes(files, repoRoot) {
  const resourceFiles = files.filter((file) => /@Path\(|@(GET|POST|PUT|PATCH|DELETE)\b/.test(file.text));
  const subresourceBaseMap = buildSubresourceBaseMap(files);
  const routes = [];
  const methodPattern = /((?:\s*@[\w.]+(?:\((?:[^()]|\([^)]*\))*\))?\s*)+)\s*(?:public\s+)?([A-Za-z0-9_<>\[\]\?., ]+)\s+([A-Za-z_][A-Za-z0-9_]*)\(([\s\S]*?)\)\s*(?:throws\s+[^{;]+)?\s*\{/g;
  for (const file of resourceFiles) {
    const className = file.text.match(/(?:class|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1] || "";
    const classPath = classLevelPath(file.text) || subresourceBaseMap.get(className) || "";
    for (const match of file.text.matchAll(methodPattern)) {
      const [, annotations, returnTypeRaw, methodName, parameters] = match;
      const verb = annotations.match(/@(GET|POST|PUT|PATCH|DELETE)\b/)?.[1];
      if (!verb) continue;
      const childPath = annotations.match(/@Path\("([^"]+)"\)/)?.[1] || "";
      const pathValue = normalizeJoinedPath(classPath, childPath);
      const bodyType = parseBodyType(parameters);
      const returnType = String(returnTypeRaw || "").trim().replace(/^Response\s*$/, "").trim();
      routes.push({
        method: verb,
        path: pathValue,
        handler_hint: explicitHandlerHint(methodName, pathValue, verb),
        controller: className || file.relativePath.split("/").pop()?.replace(/\.java$/, "") || "JaxrsResource",
        action: methodName,
        auth_hint: inferAuthHint(pathValue, methodName, parameters, annotations),
        path_params: parsePathParams(parameters),
        query_params: parseQueryParams(parameters),
        header_params: parseContextHeaders(parameters),
        input_fields: bodyType ? flattenFieldsFromType(bodyType, files, new Set(), file.filePath) : [],
        output_fields: flattenOutputFieldsFromType(returnType, files, file.filePath),
        provenance: `${relativeTo(repoRoot, file.filePath)}#${verb} ${pathValue}`
      });
    }
  }
  return routes;
}

export const jaxRsExtractor = {
  id: "api.jaxrs",
  track: "api",
  detect(context) {
    const javaFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.java$/i.test(filePath));
    const jaxrsCount = javaFiles.filter((filePath) => /@Path\(|@(GET|POST|PUT|PATCH|DELETE)\b/.test(readTextIfExists(filePath) || "")).length;
    return {
      score: jaxrsCount > 0 ? 92 : 0,
      reasons: jaxrsCount > 0 ? ["Found JAX-RS resource annotations"] : []
    };
  },
  extract(context) {
    const javaFiles = buildJavaFileIndex(context.paths);
    const routes = parseJaxrsRoutes(javaFiles, context.paths.repoRoot);
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "jaxrs_routes",
        route_count: routes.length,
        files: [...new Set(routes.map((route) => route.provenance.split("#")[0]))]
      });
      candidates.stacks.push("jaxrs");
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
    return { findings, candidates };
  }
};
