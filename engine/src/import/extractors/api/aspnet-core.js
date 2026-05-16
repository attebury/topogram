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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePublicProperties(text) {
  return [...String(text || "").matchAll(/public\s+[A-Za-z0-9_<>\[\]\?., ]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g)]
    .map((entry) => entry[1])
    .filter((name) => !name.endsWith("Id"))
    .map((name) => name.charAt(0).toLowerCase() + name.slice(1));
}

function buildDotnetFileIndex(paths) {
  const files = findPrimaryImportFiles(paths, (filePath) => /\.cs$/i.test(filePath));
  const index = new Map();
  for (const filePath of files) {
    index.set(relativeTo(paths.repoRoot, filePath), readTextIfExists(filePath) || "");
  }
  return { files, index };
}

function explicitHandlerHint(controllerName, methodName, routePath, httpMethod) {
  void controllerName;
  void methodName;
  void routePath;
  void httpMethod;
  return null;
}

function explicitEntityId(controllerName, handlerHint, routePath) {
  if (/Profiles?Controller$/.test(controllerName)) return "entity_profile";
  if (controllerName === "UserController" || controllerName === "UsersController") {
    return handlerHint === "sign_in_account" ? "entity_account" : "entity_user";
  }
  return inferApiEntityIdFromPath(routePath);
}

function routeAuthHint(bodyPrefix, methodPrefix) {
  const combined = `${bodyPrefix}\n${methodPrefix}`;
  return /\[Authorize/.test(combined) ? "secured" : "public";
}

function resolveReturnType(returnType) {
  return String(returnType || "").trim().replace(/^Task\s*</, "").replace(/>\s*$/, "").trim();
}

function findTypeBlockInText(text, bare) {
  const escaped = escapeRegExp(bare);
  const patterns = [
    new RegExp(`public\\s+class\\s+${escaped}\\b([\\s\\S]{0,2400})`, "m"),
    new RegExp(`public\\s+record\\s+class\\s+${escaped}\\b([\\s\\S]{0,1600})`, "m"),
    new RegExp(`public\\s+record\\s+${escaped}\\b([\\s\\S]{0,1600})`, "m")
  ];
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return match[0];
  }
  return null;
}

function findBlockForType(typeName, featureFiles, options = {}) {
  const raw = String(typeName || "");
  const parts = raw.split(".");
  const bare = parts.pop();
  if (!bare) return null;
  const preferredFileStem = parts[0] || null;
  const preferredDirectory = options.preferredDirectory || null;
  if (preferredFileStem && preferredDirectory) {
    const localPreferred = featureFiles.find(({ filePath }) => filePath.startsWith(preferredDirectory) && filePath.endsWith(`/${preferredFileStem}.cs`));
    if (localPreferred) {
      const snippet = findTypeBlockInText(localPreferred.text, bare);
      if (snippet) {
        return { filePath: localPreferred.filePath, text: snippet, className: bare };
      }
    }
  }
  if (preferredFileStem) {
    const preferred = featureFiles.find(({ filePath }) => filePath.endsWith(`/${preferredFileStem}.cs`));
    if (preferred) {
      const snippet = findTypeBlockInText(preferred.text, bare);
      if (snippet) {
        return { filePath: preferred.filePath, text: snippet, className: bare };
      }
    }
  }
  for (const { filePath, text } of featureFiles) {
    const snippet = findTypeBlockInText(text, bare);
    if (snippet) {
      return { filePath, text: snippet, className: bare };
    }
  }
  return null;
}

function flattenInputFields(typeName, featureFiles, options = {}, seen = new Set()) {
  const rawType = String(typeName || "").trim();
  const bare = rawType.split(".").pop();
  if (!bare || seen.has(bare)) return [];
  seen.add(bare);

  const classBlock = findBlockForType(rawType, featureFiles, options);
  if (!classBlock) return [];
  const blockText = classBlock.text;

  const recordCtor = blockText.match(new RegExp(`${bare}\\s*\\(([^)]*)\\)`));
  if (recordCtor) {
    const fields = [];
    for (const part of recordCtor[1].split(",")) {
      const trimmed = part.trim();
      const match = trimmed.match(/([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!match) continue;
      const [, innerType, name] = match;
      const normalizedName = name.charAt(0).toLowerCase() + name.slice(1);
      const nested = flattenInputFields(innerType, featureFiles, options, seen);
      if (nested.length > 0 && ["body", "data", "input", "model", "payload", "record", "request"].includes(normalizedName)) {
        fields.push(...nested);
      } else {
        fields.push(normalizedName);
      }
    }
    return [...new Set(fields)];
  }

  return [...new Set(parsePublicProperties(blockText))];
}

function flattenOutputFields(returnType, featureFiles) {
  const bare = String(returnType || "").split(".").pop();
  if (!bare) return [];
  const envelope = findBlockForType(bare, featureFiles);
  if (!envelope) return [];
  const text = envelope.text;
  const recordCtor = text.match(new RegExp(`${bare}\\s*\\(([^)]*)\\)`));
  if (recordCtor) {
    return recordCtor[1]
      .split(",")
      .map((part) => part.trim().match(/([A-Za-z_][A-Za-z0-9_]*)$/)?.[1])
      .filter(Boolean)
      .map((name) => name.charAt(0).toLowerCase() + name.slice(1));
  }
  return parsePublicProperties(text);
}

function parseControllerHeader(text) {
  const headerMatch = String(text || "").match(/((?:\s*\[[^\]]+\]\s*)*)\s*public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)Controller\b/m);
  if (!headerMatch) return null;
  return {
    attributes: headerMatch[1] || "",
    controllerName: `${headerMatch[2]}Controller`
  };
}

function parseControllerRoutes(filePath, text, featureFiles, repoRoot) {
  const routes = [];
  const preferredDirectory = filePath.slice(0, filePath.lastIndexOf("/"));

  const header = parseControllerHeader(text);
  const controllerName = header?.controllerName || filePath.split("/").pop()?.replace(/\.cs$/, "") || "";
  const classAttributes = header?.attributes || "";
  const classRouteTemplate = classAttributes.match(/\[Route\("([^"]+)"\)\]/)?.[1] || "";
  const classRoute = classRouteTemplate.replace(/\[controller\]/gi, controllerName.replace(/Controller$/, ""));
  const classAuthorized = /\[Authorize[^\]]*\]/.test(classAttributes);
  const methodMatches = [
    ...text.matchAll(
      /(?:^|\n)((?:\s*\[[^\]]+\]\s*)*)\s*public\s+(?!class\b)(?:async\s+)?([A-Za-z0-9_<>\[\]\?., ]+)\s+([A-Za-z_][A-Za-z0-9_]*)\(([\s\S]*?)\)\s*(?:=>|\{)/gm
    )
  ];

  for (const match of methodMatches) {
    const [, attributes, returnTypeRaw, methodName, parameters] = match;
    const httpMatch = attributes.match(/\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete)(?:\("([^"]*)"\))?\]/);
    if (!httpMatch) continue;
    const httpMethod = httpMatch[1].replace(/^Http/, "").toUpperCase();
    const methodRoute = httpMatch[2] || "";
    const routePath = normalizeOpenApiPath(`/${[classRoute, methodRoute].filter(Boolean).join("/")}`);
    const pathParams = [...routePath.matchAll(/\{([^}]+)\}/g)].map((entry) => ({ name: entry[1], required: true, type: null }));
    const queryParams = [...parameters.matchAll(/\[FromQuery\]\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => ({ name: entry[2], required: false, type: entry[1] || null }));
    const bodyType = parameters.match(/\[FromBody\]\s+([A-Za-z0-9_<>\[\]\?\.]+)\s+[A-Za-z_][A-Za-z0-9_]*/)?.[1] || null;
    const returnType = resolveReturnType(returnTypeRaw);
    const handler_hint = explicitHandlerHint(controllerName, methodName, routePath, httpMethod);

    routes.push({
      method: httpMethod,
      path: routePath,
      handler_hint,
      auth_hint: routeAuthHint(classAuthorized ? "[Authorize]" : "", attributes),
      controller: controllerName,
      method_name: methodName,
      return_type: returnType,
      body_type: bodyType,
      path_params: pathParams,
      query_params: queryParams,
      input_fields: bodyType ? flattenInputFields(bodyType, featureFiles, { preferredDirectory }) : [],
      output_fields: flattenOutputFields(returnType, featureFiles),
      provenance: `${relativeTo(repoRoot, filePath)}#${httpMethod} ${routePath}`
    });
  }

  return routes;
}

export const aspNetCoreExtractor = {
  id: "api.aspnet-core",
  track: "api",
  detect(context) {
    const controllerFiles = findPrimaryImportFiles(context.paths, (filePath) => /Controller\.cs$/i.test(filePath));
    const programFiles = findPrimaryImportFiles(context.paths, (filePath) => /Program\.cs$/i.test(filePath));
    const score = controllerFiles.length > 0 && programFiles.some((filePath) => /WebApplication\.CreateBuilder|AddSwaggerGen|AddMvc/.test(readTextIfExists(filePath) || "")) ? 88 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found ASP.NET Core controllers and application bootstrap"] : []
    };
  },
  extract(context) {
    const controllerFiles = findPrimaryImportFiles(context.paths, (filePath) => /Controller\.cs$/i.test(filePath));
    const featureFiles = buildDotnetFileIndex(context.paths).files.map((filePath) => ({ filePath, text: readTextIfExists(filePath) || "" }));
    const findings = [];
    const candidates = { capabilities: [], routes: [], stacks: [] };

    for (const filePath of controllerFiles) {
      const text = readTextIfExists(filePath) || "";
      const routes = parseControllerRoutes(filePath, text, featureFiles, context.paths.repoRoot);
      if (routes.length === 0) continue;
      findings.push({
        kind: "aspnet_controller",
        file: relativeTo(context.paths.repoRoot, filePath),
        route_count: routes.length
      });

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
        header_params: [],
        input_fields: route.input_fields,
        output_fields: route.output_fields,
        auth_hint: route.auth_hint,
        entity_id: explicitEntityId(route.controller, route.handler_hint, route.path),
        controller: route.controller,
        return_type: route.return_type,
        body_type: route.body_type,
        track: "api"
      })));

      candidates.routes.push(...routes.map((route) => ({
        path: route.path,
        method: route.method,
        confidence: "high",
        source_kind: "route_code",
        provenance: route.provenance
      })));
    }

    candidates.capabilities = dedupeCandidateRecords(candidates.capabilities, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(
      candidates.routes.map((route) => ({ ...route, id_hint: `${route.method}_${route.path}` })),
      (record) => `${record.method}:${record.path}:${record.source_kind}`
    ).map(({ id_hint, ...route }) => route);
    candidates.stacks = ["aspnet_core"];
    return { findings, candidates };
  }
};
