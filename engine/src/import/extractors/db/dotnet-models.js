import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function normalizeCsType(typeName) {
  const normalized = String(typeName || "").replace(/\?$/, "").trim();
  switch (normalized.toLowerCase()) {
    case "string": return "string";
    case "int":
    case "int32": return "int";
    case "long":
    case "int64": return "bigint";
    case "bool":
    case "boolean": return "boolean";
    case "double": return "double";
    case "float": return "float";
    default: return idHintify(normalized) || "string";
  }
}

function parseCsModel(text, provenance) {
  const classMatch = String(text || "").match(/class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z0-9_, ]+))?\s*\{([\s\S]*?)\n\}/m);
  if (!classMatch) return null;
  const className = classMatch[1];
  const body = classMatch[3];
  const fields = [];
  for (const match of body.matchAll(/public\s+([A-Za-z0-9_<>,?.]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g)) {
    const [, typeName, name] = match;
    const normalizedName = /^ID$/i.test(name) ? "id" : name.charAt(0).toLowerCase() + name.slice(1);
    fields.push({
      name: normalizedName,
      field_type: normalizeCsType(typeName),
      required: !String(typeName).includes("?"),
      list: /^IEnumerable<|^List</.test(typeName),
      unique: false,
      primary_key: /^id$/i.test(name)
    });
  }
  if (fields.length === 0) return null;
  const stem = canonicalCandidateTerm(idHintify(className.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
  return makeCandidateRecord({
    kind: "entity",
    idHint: `entity_${stem}`,
    label: titleCase(stem),
    confidence: "medium",
    sourceKind: "schema",
    provenance,
    model_name: className,
    fields,
    track: "db"
  });
}

export const dotnetModelsExtractor = {
  id: "db.dotnet-models",
  track: "db",
  detect(context) {
    const modelFiles = findPrimaryImportFiles(context.paths, (filePath) => /\/Models\/.+\.cs$/i.test(filePath));
    const csprojFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.csproj$/i.test(filePath));
    const score = modelFiles.length > 0 && csprojFiles.length > 0 ? 78 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found .NET model classes in a project with .csproj"] : []
    };
  },
  extract(context) {
    const modelFiles = findPrimaryImportFiles(context.paths, (filePath) => /\/Models\/.+\.cs$/i.test(filePath));
    const findings = [];
    const entities = [];
    for (const filePath of modelFiles) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const entity = parseCsModel(context.helpers.readTextIfExists(filePath) || "", provenance);
      if (!entity) continue;
      entities.push(entity);
      findings.push({ kind: "dotnet_model", file: provenance, entity_id: entity.id_hint });
    }
    return {
      findings,
      candidates: {
        entities: dedupeCandidateRecords(entities, (record) => record.id_hint),
        enums: [],
        relations: [],
        indexes: []
      }
    };
  }
};
