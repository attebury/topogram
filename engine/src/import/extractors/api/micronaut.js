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

function explicitHandlerHint(methodName, routePath, httpMethod) {
  const low = String(methodName || "").toLowerCase();
  if (httpMethod === "GET" && /\/articles\/feed$/.test(routePath)) return "feed_article";
  if (httpMethod === "POST" && /\/articles\/\{slug\}\/favorite$/.test(routePath)) return "favorite_article";
  if (httpMethod === "DELETE" && /\/articles\/\{slug\}\/favorite$/.test(routePath)) return "unfavorite_article";
  if (httpMethod === "GET" && /\/articles\/\{slug\}\/comments$/.test(routePath)) return "list_comments";
  if (httpMethod === "POST" && /\/articles\/\{slug\}\/comments$/.test(routePath)) return "create_comment";
  if (httpMethod === "DELETE" && /\/articles\/\{slug\}\/comments\/\{id\}$/.test(routePath)) return "delete_comment";
  if (httpMethod === "GET" && /\/profiles\/\{username\}$/.test(routePath)) return "get_profile";
  if (httpMethod === "POST" && /\/profiles\/\{username\}\/follow$/.test(routePath)) return "follow_profile";
  if (httpMethod === "DELETE" && /\/profiles\/\{username\}\/follow$/.test(routePath)) return "unfollow_profile";
  if (httpMethod === "POST" && /\/users\/login$/.test(routePath)) return "sign_in_account";
  if (httpMethod === "POST" && routePath === "/users") return "create_user";
  if (httpMethod === "GET" && routePath === "/user") return "get_user";
  if ((httpMethod === "PUT" || httpMethod === "PATCH") && routePath === "/user") return "update_user";
  if (httpMethod === "GET" && routePath === "/tags") return "list_tags";
  if (httpMethod === "GET" && /\/articles\/\{slug\}$/.test(routePath)) return "get_article";
  if (httpMethod === "GET" && routePath === "/articles") return "list_articles";
  if (httpMethod === "POST" && routePath === "/articles") return "create_article";
  if ((httpMethod === "PUT" || httpMethod === "PATCH") && /\/articles\/\{slug\}$/.test(routePath)) return "update_article";
  if (httpMethod === "DELETE" && /\/articles\/\{slug\}$/.test(routePath)) return "delete_article";
  if (low.includes("favorite")) return low.startsWith("un") ? "unfavorite_article" : "favorite_article";
  if (low.includes("comment")) {
    if (low.startsWith("delete")) return "delete_comment";
    if (low.startsWith("add") || low.startsWith("create")) return "create_comment";
    return "list_comments";
  }
  if (low.includes("follow")) return low.startsWith("un") ? "unfollow_profile" : "follow_profile";
  if (low === "login") return "sign_in_account";
  if (low === "register") return "create_user";
  if (low === "current") return "get_user";
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
    new RegExp(`(?:public\\s+)?record\\s+${bare}\\b[\\s\\S]{0,2400}?\\n\\}`, "m"),
    new RegExp(`(?:public\\s+)?class\\s+${bare}\\b[\\s\\S]{0,3600}?\\n\\}`, "m"),
    new RegExp(`(?:public\\s+)?interface\\s+${bare}\\b[\\s\\S]{0,2400}?\\n\\}`, "m")
  ];
  const orderedFiles = preferredFile
    ? [...files.filter((file) => file.filePath === preferredFile), ...files.filter((file) => file.filePath !== preferredFile)]
    : files;
  for (const file of orderedFiles) {
    for (const pattern of patterns) {
      const match = file.text.match(pattern);
      if (match) return { filePath: file.filePath, text: match[0] };
    }
  }
  return null;
}

function flattenFieldsFromType(typeName, files, preferredFile = null, seen = new Set()) {
  const bare = String(typeName || "").split(".").pop();
  const key = `${preferredFile || ""}:${bare}`;
  if (!bare || seen.has(key)) return [];
  seen.add(key);
  const block = findJavaTypeBlock(typeName, files, preferredFile);
  if (!block) return [];
  const recordFields = parseRecordFields(block.text);
  if (recordFields.length > 0) return [...new Set(recordFields.map((field) => field.name))];
  return [...new Set(parseClassFields(block.text).map((field) => field.name))];
}

function parseQueryParams(parameters) {
  return [...String(parameters || "").matchAll(/@QueryValue(?:\(value\s*=\s*"([^"]+)".*?\))?\s+@Nullable\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)|@QueryValue(?:\(value\s*=\s*"([^"]+)".*?\))?\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({
      name: entry[1] || entry[4] || entry[3] || entry[6],
      required: false,
      type: entry[2] || entry[5] || null
    }));
}

function parsePathParams(parameters) {
  return [...String(parameters || "").matchAll(/@PathVariable\("([^"]+)"\)\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((entry) => ({ name: entry[1] || entry[3], required: true, type: entry[2] || null }));
}

function parseBodyType(parameters) {
  const match = String(parameters || "").match(/@Body\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : null;
}

function parseMicronautRoutes(files, repoRoot) {
  const opFiles = files.filter((file) => /\/api\/operation\/.+Operations\.java$/.test(file.relativePath) || /io\.micronaut\.http\.annotation\./.test(file.text));
  const routes = [];
  const methodPattern = /((?:\s*@[\w.]+(?:\((?:[^()]|\([^)]*\))*\))?\s*)+)\s*(?:public\s+)?(?:default\s+)?([A-Za-z0-9_<>\[\]\?., ]+)\s+([A-Za-z_][A-Za-z0-9_]*)\(([\s\S]*?)\)\s*;/g;
  for (const file of opFiles) {
    for (const match of file.text.matchAll(methodPattern)) {
      const [, annotations, returnType, methodName, parameters] = match;
      const verb = annotations.match(/@(Get|Post|Put|Patch|Delete)\(/)?.[1];
      const pathRaw = annotations.match(/@(Get|Post|Put|Patch|Delete)\("([^"]+)"\)/)?.[2];
      if (!verb || !pathRaw) continue;
      const pathValue = normalizeOpenApiPath(pathRaw.replace(/\{\?[^}]+\}/g, ""));
      const bodyType = parseBodyType(parameters);
      routes.push({
        method: verb.toUpperCase(),
        path: pathValue,
        handler_hint: explicitHandlerHint(methodName, pathValue, verb.toUpperCase()),
        controller: file.relativePath.split("/").pop()?.replace(/\.java$/, "") || "MicronautOperations",
        action: methodName,
        auth_hint: pathValue === "/users/login" || pathValue === "/users" || pathValue === "/tags" || pathValue === "/articles" || /^\/profiles\/\{username\}$/.test(pathValue) ? "public" : "secured",
        path_params: parsePathParams(parameters),
        query_params: parseQueryParams(parameters),
        header_params: [],
        input_fields: bodyType ? flattenFieldsFromType(bodyType, files, file.filePath) : [],
        output_fields: flattenFieldsFromType(returnType, files, file.filePath),
        provenance: `${relativeTo(repoRoot, file.filePath)}#${verb.toUpperCase()} ${pathValue}`
      });
    }
  }
  return routes;
}

export const micronautExtractor = {
  id: "api.micronaut",
  track: "api",
  detect(context) {
    const javaFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.java$/i.test(filePath));
    const count = javaFiles.filter((filePath) => /io\.micronaut\.http\.annotation|@Controller\(|@Get\(|@Post\(|@Put\(|@Delete\(/.test(readTextIfExists(filePath) || "")).length;
    return {
      score: count > 0 ? 95 : 0,
      reasons: count > 0 ? ["Found Micronaut HTTP annotations or operation interfaces"] : []
    };
  },
  extract(context) {
    const javaFiles = buildJavaFileIndex(context.paths);
    const routes = parseMicronautRoutes(javaFiles, context.paths.repoRoot);
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };
    if (routes.length > 0) {
      findings.push({
        kind: "micronaut_routes",
        route_count: routes.length,
        files: [...new Set(routes.map((route) => route.provenance.split("#")[0]))]
      });
      candidates.stacks.push("micronaut");
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
