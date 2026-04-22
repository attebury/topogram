import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function inferRetrofitCapabilityId(resource, methodName, httpMethod, routePath) {
  const stem = canonicalCandidateTerm(resource);
  const normalizedMethod = String(methodName || "").toLowerCase();
  if (httpMethod === "GET" && /list|fetch.*list/.test(normalizedMethod)) return `cap_list_${stem}s`;
  if (httpMethod === "GET" && /info|detail|get/.test(normalizedMethod)) return `cap_get_${stem}`;
  if (httpMethod === "POST" && /create|add/.test(normalizedMethod)) return `cap_create_${stem}`;
  if (httpMethod === "PATCH" || httpMethod === "PUT") return `cap_update_${stem}`;
  if (httpMethod === "DELETE") return `cap_delete_${stem}`;
  const routeStem = canonicalCandidateTerm((routePath.split("/").filter(Boolean)[0] || stem).replace(/[{}]/g, ""));
  if (httpMethod === "GET" && /\{/.test(routePath)) return `cap_get_${routeStem}`;
  if (httpMethod === "GET") return `cap_list_${routeStem}s`;
  return `cap_${httpMethod.toLowerCase()}_${routeStem}`;
}

function parseRetrofitInterface(text, provenance) {
  const ifaceMatch = String(text || "").match(/interface\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m);
  if (!ifaceMatch) return [];
  const interfaceName = ifaceMatch[1];
  const resource = canonicalCandidateTerm(interfaceName.replace(/Service$/, "").replace(/Client$/, ""));
  const capabilities = [];
  for (const match of String(text || "").matchAll(/@(GET|POST|PUT|PATCH|DELETE)\("([^"]+)"\)[\s\S]*?suspend\s+fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*:\s*([A-Za-z0-9_<>,?. ]+)/g)) {
    const [, httpMethod, rawPath, methodName, params, returnType] = match;
    const endpointPath = `/${rawPath.replace(/^\/+/, "")}`;
    const pathParams = [...String(params || "").matchAll(/@Path\("([^"]+)"\)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/g)]
      .map((entry) => ({ name: entry[1], required: true, type: null }));
    const queryParams = [...String(params || "").matchAll(/@Query\("([^"]+)"\)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_<>,?.]+)/g)]
      .map((entry) => ({ name: entry[1], required: !entry[3].includes("?"), type: entry[3] }));
    const returnStem = String(returnType || "").match(/<([^>]+)>/)?.[1] || String(returnType || "");
    const outputFields = /^List</.test(String(returnType || "")) ? [canonicalCandidateTerm(returnStem), `${canonicalCandidateTerm(returnStem)}s`] : [canonicalCandidateTerm(returnStem)];
    const routeResource = canonicalCandidateTerm(endpointPath.split("/").filter(Boolean)[0] || resource);
    const capabilityId = inferRetrofitCapabilityId(routeResource, methodName, httpMethod, endpointPath);
    const entityStem = canonicalCandidateTerm(routeResource === "pokemon" ? "pokemon" : routeResource);
    capabilities.push(makeCandidateRecord({
      kind: "capability",
      idHint: capabilityId,
      label: titleCase(capabilityId.replace(/^cap_/, "")),
      confidence: "high",
      sourceKind: "route_code",
      provenance: `${provenance}#${httpMethod} ${endpointPath}`,
      endpoint: { method: httpMethod, path: endpointPath },
      path_params: pathParams,
      query_params: queryParams,
      header_params: [],
      input_fields: [],
      output_fields: [...new Set(outputFields.filter(Boolean))],
      auth_hint: "public",
      entity_id: `entity_${entityStem}`,
      retrofit_interface: interfaceName,
      track: "api"
    }));
  }

  return capabilities;
}

export const retrofitExtractor = {
  id: "api.retrofit",
  track: "api",
  detect(context) {
    const serviceFiles = findImportFiles(context.paths, (filePath) => /Service\.kt$/i.test(filePath) || /retrofit\/.+\.kt$/i.test(filePath));
    const score = serviceFiles.some((filePath) => /@GET|@POST|@PUT|@PATCH|@DELETE/.test(context.helpers.readTextIfExists(filePath) || "")) ? 87 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Retrofit service or API interfaces"] : []
    };
  },
  extract(context) {
    const serviceFiles = findImportFiles(context.paths, (filePath) => /Service\.kt$/i.test(filePath) || /retrofit\/.+\.kt$/i.test(filePath));
    const capabilities = [];
    for (const filePath of serviceFiles) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      capabilities.push(...parseRetrofitInterface(context.helpers.readTextIfExists(filePath) || "", provenance));
    }
    const findings = capabilities.length > 0 ? [{
      kind: "android_retrofit",
      files: [...new Set(capabilities.flatMap((entry) => entry.provenance || []).map((entry) => String(entry).split("#")[0]))],
      capability_count: capabilities.length
    }] : [];
    return {
      findings,
      candidates: {
        capabilities: dedupeCandidateRecords(capabilities, (record) => record.id_hint),
        routes: capabilities.map((entry) => ({
          path: entry.endpoint.path,
          method: entry.endpoint.method,
          confidence: entry.confidence,
          source_kind: entry.source_kind,
          provenance: entry.provenance?.[0] || null
        })),
        stacks: capabilities.length > 0 ? ["retrofit"] : []
      }
    };
  }
};
