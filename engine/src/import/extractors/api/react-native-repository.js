import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function pluralizeStem(stem) {
  if (stem.endsWith("s")) return stem;
  return `${stem}s`;
}

function stemFromRepoPath(filePath) {
  return canonicalCandidateTerm(filePath.match(/\/src\/([^/]+)\//)?.[1] || "item");
}

function capabilityIdFor(stem, methodName, httpMethod) {
  const normalizedMethod = String(methodName || "").toLowerCase();
  if (httpMethod === "GET" && /^find/.test(normalizedMethod)) {
    return `cap_get_${stem}`;
  }
  if (httpMethod === "GET") {
    return `cap_list_${pluralizeStem(stem)}`;
  }
  if (httpMethod === "POST") {
    return `cap_create_${stem}`;
  }
  if (httpMethod === "PATCH" || httpMethod === "PUT") {
    return `cap_update_${stem}`;
  }
  if (httpMethod === "DELETE") {
    return `cap_delete_${stem}`;
  }
  return `cap_${normalizedMethod}_${stem}`;
}

function parseRepositoryFile(text, provenance, filePath) {
  const stem = stemFromRepoPath(filePath);
  const baseUrlMatch = String(text || "").match(/baseUrl\s*=\s*["'`]([^"'`]+)["'`]/);
  const basePath = baseUrlMatch?.[1] || `/${pluralizeStem(stem)}`;
  const capabilities = [];
  const methods = [...String(text || "").matchAll(/public\s+async\s+([A-Za-z_][A-Za-z0-9_]*)\(([\s\S]*?)\)\s*(?::\s*[\s\S]*?)?\s*\{/g)];
  for (let index = 0; index < methods.length; index += 1) {
    const [, methodName, argsSource] = methods[index];
    const bodyStart = methods[index].index + methods[index][0].length;
    const bodyEnd = index + 1 < methods.length ? methods[index + 1].index : String(text || "").length;
    const body = String(text || "").slice(bodyStart, bodyEnd);
    const callMatch = body.match(/this\.httpClient\.(get|post|patch|put|delete)(?:<[\s\S]*?>)?\(([\s\S]*?)\)/i);
    if (!callMatch) continue;
    const httpMethod = callMatch[1].toUpperCase();
    const path = /\$\{this\.baseUrl\}\/\$\{/.test(callMatch[2])
      ? `${basePath}/{id}`
      : basePath;
    const pathParams = /\{id\}/.test(path) ? [{ name: "id", required: true, type: "int" }] : [];
    const inputFields = [...new Set([
      ...[...String(argsSource || "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((entry) => entry[1]),
      ...[...String(body || "").matchAll(/payload\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1])
    ])].filter((field) => field !== "id");
    const outputFields = httpMethod === "GET"
      ? (/count/.test(body) ? [pluralizeStem(stem), "count"] : (/map\(/.test(body) ? [pluralizeStem(stem)] : ["id", "title", "body"]))
      : [];
    capabilities.push(makeCandidateRecord({
      kind: "capability",
      idHint: capabilityIdFor(stem, methodName, httpMethod),
      label: titleCase(capabilityIdFor(stem, methodName, httpMethod).replace(/^cap_/, "")),
      confidence: "high",
      sourceKind: "route_code",
      provenance: `${provenance}#${methodName}`,
      endpoint: { method: httpMethod, path },
      path_params: pathParams,
      query_params: [],
      header_params: [],
      input_fields: inputFields,
      output_fields: outputFields,
      auth_hint: "public",
      entity_id: `entity_${stem}`,
      track: "api"
    }));
  }
  return capabilities;
}

export const reactNativeRepositoryExtractor = {
  id: "api.react-native-repository",
  track: "api",
  detect(context) {
    const files = findImportFiles(
      context.paths,
      (filePath) => /\/src\/.+\/infrastructure\/implementations\/.+Repository\.ts$/i.test(filePath)
    );
    const score = files.some((filePath) => /this\.httpClient\.(get|post|patch|put|delete)\(/.test(context.helpers.readTextIfExists(filePath) || "")) ? 84 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found React Native repositories backed by an HTTP client"] : []
    };
  },
  extract(context) {
    const files = findImportFiles(
      context.paths,
      (filePath) => /\/src\/.+\/infrastructure\/implementations\/.+Repository\.ts$/i.test(filePath)
    );
    const capabilities = [];
    for (const filePath of files) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      capabilities.push(...parseRepositoryFile(context.helpers.readTextIfExists(filePath) || "", provenance, filePath));
    }
    return {
      findings: capabilities.length > 0 ? [{
        kind: "react_native_repository",
        files: [...new Set(capabilities.flatMap((entry) => entry.provenance || []).map((entry) => String(entry).split("#")[0]))],
        capability_count: capabilities.length
      }] : [],
      candidates: {
        capabilities: dedupeCandidateRecords(capabilities, (record) => `${record.id_hint}:${record.endpoint?.method}:${record.endpoint?.path}`),
        routes: capabilities.map((entry) => ({
          path: entry.endpoint.path,
          method: entry.endpoint.method,
          confidence: entry.confidence,
          source_kind: entry.source_kind,
          provenance: entry.provenance?.[0] || null
        })),
        stacks: capabilities.length > 0 ? ["react_native_http"] : []
      }
    };
  }
};
