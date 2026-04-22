import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function featureStemFromPath(filePath) {
  return canonicalCandidateTerm(filePath.match(/\/features\/([^/]+)\//)?.[1] || "item");
}

function pluralizeStem(stem) {
  if (stem.endsWith("s")) return stem;
  return `${stem}s`;
}

function capabilityIdFor(featureStem, methodName, httpMethod) {
  const stem = canonicalCandidateTerm(featureStem);
  const normalizedMethod = String(methodName || "").toLowerCase();
  if (httpMethod === "GET") {
    return `cap_list_${pluralizeStem(stem)}`;
  }
  if (httpMethod === "POST") {
    return `cap_create_${stem}`;
  }
  if (httpMethod === "PUT" || httpMethod === "PATCH") {
    return `cap_update_${stem}`;
  }
  if (httpMethod === "DELETE") {
    return `cap_delete_${stem}`;
  }
  return `cap_${normalizedMethod}_${stem}`;
}

function extractApiConfigPaths(context) {
  const configFile = findImportFiles(context.paths, (filePath) => /\/lib\/common\/network\/api_config\.dart$/i.test(filePath))[0];
  const mapping = new Map();
  if (!configFile) return mapping;
  const text = context.helpers.readTextIfExists(configFile) || "";
  for (const match of text.matchAll(/static\s+const\s+String\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']+)'/g)) {
    mapping.set(match[1], match[2]);
  }
  return mapping;
}

function parseDatasourceFile(text, provenance, filePath, apiConfigPaths) {
  const featureStem = featureStemFromPath(filePath);
  const capabilities = [];
  const methods = [...String(text || "").matchAll(/Future<[\s\S]*?>\s+([A-Za-z_][A-Za-z0-9_]*)\([^)]*\)\s+async\s*\{/g)];
  for (let index = 0; index < methods.length; index += 1) {
    const methodName = methods[index][1];
    const bodyStart = methods[index].index + methods[index][0].length;
    const bodyEnd = index + 1 < methods.length ? methods[index + 1].index : String(text || "").length;
    const body = String(text || "").slice(bodyStart, bodyEnd);
    const dioCall = body.match(/dioClient\.dio\.(get|post|put|patch|delete)\(([\s\S]*?)\)/i);
    if (!dioCall) continue;
    const httpMethod = dioCall[1].toUpperCase();
    const callArgs = dioCall[2];
    const apiRef = callArgs.match(/ApiConfig\.([A-Za-z_][A-Za-z0-9_]*)/);
    const basePath = apiConfigPaths.get(apiRef?.[1] || "") || `/${pluralizeStem(featureStem)}`;
    const dynamicPath = callArgs.match(/"\$\{ApiConfig\.[A-Za-z_][A-Za-z0-9_]*\}\/\$\{[^}]+\}"/);
    const path = dynamicPath ? `${basePath}/{id}` : basePath;
    const queryParams = [...body.matchAll(/'([^']+)'\s*:\s*[^,}]+/g)]
      .map((entry) => ({ name: entry[1], required: false, type: null }));
    const outputFields = /^GET$/.test(httpMethod) ? [pluralizeStem(featureStem)] : [];
    const inputFields = [...new Set([...callArgs.matchAll(/data:\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]))];
    capabilities.push(makeCandidateRecord({
      kind: "capability",
      idHint: capabilityIdFor(featureStem, methodName, httpMethod),
      label: titleCase(capabilityIdFor(featureStem, methodName, httpMethod).replace(/^cap_/, "")),
      confidence: "high",
      sourceKind: "route_code",
      provenance: `${provenance}#${methodName}`,
      endpoint: { method: httpMethod, path },
      path_params: /\{id\}/.test(path) ? [{ name: "id", required: true, type: null }] : [],
      query_params: queryParams,
      header_params: [],
      input_fields: inputFields,
      output_fields: outputFields,
      auth_hint: "public",
      entity_id: `entity_${featureStem}`,
      track: "api"
    }));
  }
  return capabilities;
}

export const flutterDioExtractor = {
  id: "api.flutter-dio",
  track: "api",
  detect(context) {
    const files = findImportFiles(
      context.paths,
      (filePath) => /\/lib\/features\/.+\/data\/datasources\/.+_remote_data_source\.dart$/i.test(filePath)
    );
    const score = files.some((filePath) => /dioClient\.dio\./.test(context.helpers.readTextIfExists(filePath) || "")) ? 85 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Flutter remote data sources using Dio"] : []
    };
  },
  extract(context) {
    const files = findImportFiles(
      context.paths,
      (filePath) => /\/lib\/features\/.+\/data\/datasources\/.+_remote_data_source\.dart$/i.test(filePath)
    );
    const apiConfigPaths = extractApiConfigPaths(context);
    const capabilities = [];
    for (const filePath of files) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      capabilities.push(...parseDatasourceFile(context.helpers.readTextIfExists(filePath) || "", provenance, filePath, apiConfigPaths));
    }
    const findings = capabilities.length > 0 ? [{
      kind: "flutter_dio",
      files: [...new Set(capabilities.flatMap((entry) => entry.provenance || []).map((entry) => String(entry).split("#")[0]))],
      capability_count: capabilities.length
    }] : [];
    return {
      findings,
      candidates: {
        capabilities: dedupeCandidateRecords(capabilities, (record) => `${record.id_hint}:${record.endpoint?.method}:${record.endpoint?.path}`),
        routes: capabilities.map((entry) => ({
          path: entry.endpoint.path,
          method: entry.endpoint.method,
          confidence: entry.confidence,
          source_kind: entry.source_kind,
          provenance: entry.provenance?.[0] || null
        })),
        stacks: capabilities.length > 0 ? ["flutter_dio"] : []
      }
    };
  }
};
