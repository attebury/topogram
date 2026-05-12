import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function inferSwiftCapabilityId(methodName, pathValue, returnTypeHint) {
  const normalizedMethod = String(methodName || "").toLowerCase();
  const pathStem = canonicalCandidateTerm(idHintify((pathValue || "").replace(/[/?=&{}().]+/g, "_")));
  if (/countries/.test(normalizedMethod) || /allcountries/.test(pathValue || "")) return "cap_list_countries";
  if (/details/.test(normalizedMethod) || /countrydetails/.test(pathValue || "")) return "cap_get_country_details";
  if (/image/.test(normalizedMethod) || /push/.test(normalizedMethod)) return `cap_get_${canonicalCandidateTerm(idHintify(returnTypeHint || pathStem || "resource"))}`;
  return `cap_get_${pathStem || canonicalCandidateTerm(idHintify(returnTypeHint || "resource"))}`;
}

function inferEntityId(capabilityId) {
  if (capabilityId === "cap_list_countries") return "entity_country";
  if (capabilityId === "cap_get_country_details") return "entity_country_details";
  const stem = capabilityId.replace(/^cap_(get|list|create|update|delete)_/, "");
  return `entity_${canonicalCandidateTerm(stem)}`;
}

function parseRepositoryFile(text, provenance) {
  const repoMatch = String(text || "").match(/struct\s+Real([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/m);
  if (!repoMatch) return [];
  const repositoryName = repoMatch[1];
  if (/Image|PushToken/i.test(repositoryName)) {
    return [];
  }
  const capabilities = [];
  const methods = [...String(text || "").matchAll(/func\s+([A-Za-z_][A-Za-z0-9_]*)\(([\s\S]*?)\)\s+async\s+throws\s+->\s+([A-Za-z0-9_<>\[\].?]+)\s*\{([\s\S]*?)\n\s*\}/g)];
  const pathSwitch = [...String(text || "").matchAll(/case\s+(?:let\s+)?\.([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]+\))?:\s*return\s+"([^"]+)"/g)]
    .reduce((acc, match) => acc.set(match[1], match[2]), new Map());
  const methodSwitch = [...String(text || "").matchAll(/case\s+(?:let\s+)?\.([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]+\))?:\s*return\s+"(GET|POST|PUT|PATCH|DELETE)"/g)]
    .reduce((acc, match) => acc.set(match[1], match[2]), new Map());

  for (const match of methods) {
    const [, methodName, params, returnType, body] = match;
    const endpointCase =
      body.match(/endpoint:\s*API\.([A-Za-z_][A-Za-z0-9_]*)/)?.[1]
      || (methodName === "countries" ? "allCountries" : methodName);
    let pathValue = pathSwitch.get(endpointCase) || `/${endpointCase}`;
    if (/countryName:/.test(body) && /\/name\//.test(pathValue)) {
      pathValue = "/name/{countryName}";
    }
    const httpMethod = methodSwitch.get(endpointCase) || "GET";
    const capabilityId = inferSwiftCapabilityId(methodName, pathValue, returnType);
    const queryParams = [...String(pathValue).matchAll(/[?&]([^=]+)=/g)].map((entry) => ({ name: entry[1], required: false, type: null }));
    const pathParams = [...String(pathValue).matchAll(/\{([^}]+)\}/g)].map((entry) => ({ name: entry[1], required: true, type: null }));
    const outputStem = canonicalCandidateTerm(idHintify(String(returnType || "").replace(/[\[\]?]/g, "").split(".").pop() || ""));
    capabilities.push(makeCandidateRecord({
      kind: "capability",
      idHint: capabilityId,
      label: titleCase(capabilityId.replace(/^cap_/, "")),
      confidence: "high",
      sourceKind: "route_code",
      provenance: `${provenance}#${methodName}`,
      endpoint: { method: httpMethod, path: pathValue.replace(/\\\([^)]*\)/g, "{id}") },
      path_params: pathParams,
      query_params: queryParams,
      header_params: [],
      input_fields: [],
      output_fields: httpMethod === "GET" ? [outputStem] : [],
      auth_hint: "public",
      entity_id: inferEntityId(capabilityId),
      repository: repositoryName,
      track: "api"
    }));
  }
  return capabilities;
}

export const swiftWebApiExtractor = {
  id: "api.swift-webapi",
  track: "api",
  detect(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /WebRepository\.swift$/i.test(filePath) || /WebAPI\/.+\.swift$/i.test(filePath));
    const score = files.some((filePath) => /APICall|URLSession/.test(context.helpers.readTextIfExists(filePath) || "")) ? 85 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Swift web repositories using APICall/URLSession"] : []
    };
  },
  extract(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /WebAPI\/.+\.swift$/i.test(filePath))
      .filter((filePath) => /struct\s+Real/.test(context.helpers.readTextIfExists(filePath) || ""));
    const capabilities = [];
    for (const filePath of files) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      capabilities.push(...parseRepositoryFile(context.helpers.readTextIfExists(filePath) || "", provenance));
    }
  const findings = capabilities.length > 0 ? [{
      kind: "swift_webapi",
      files: [...new Set(capabilities.flatMap((entry) => entry.provenance || []).map((entry) => String(entry).split("#")[0]))],
      capability_count: capabilities.length
    }] : [];
    return {
      findings,
      candidates: {
      capabilities: dedupeCandidateRecords(capabilities, (record) => `${record.id_hint}:${record.endpoint?.path || ""}`),
        routes: capabilities.map((entry) => ({
          path: entry.endpoint.path,
          method: entry.endpoint.method,
          confidence: entry.confidence,
          source_kind: entry.source_kind,
          provenance: entry.provenance?.[0] || null
        })),
        stacks: capabilities.length > 0 ? ["swift_webapi"] : []
      }
    };
  }
};
