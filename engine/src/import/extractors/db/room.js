import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function kotlinTypeToFieldType(typeName) {
  const normalized = String(typeName || "").replace(/\?$/, "");
  switch (normalized) {
    case "String": return "string";
    case "Int": return "int";
    case "Long": return "bigint";
    case "Float": return "float";
    case "Double": return "double";
    case "Boolean": return "boolean";
    default:
      if (/^List<.+>$/.test(normalized)) return "json";
      return normalized || "string";
  }
}

function roomEntityStem(name) {
  return idHintify(
    canonicalCandidateTerm(
      String(name || "").replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    )
  );
}

function parseEntityFile(text, provenance) {
  const classMatch = String(text || "").match(/@Entity(?:\([^)]*\))?[\s\S]*?data\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*$/m);
  if (!classMatch) return null;
  const className = classMatch[1];
  const fieldsBlock = classMatch[2];
  const fields = [];
  let currentPrimaryKey = false;

  for (const rawLine of fieldsBlock.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line) continue;
    if (line.startsWith("@PrimaryKey")) {
      currentPrimaryKey = true;
      continue;
    }
    const match = line.match(/^(?:var|val)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=,]+)/);
    if (!match) continue;
    const [, name, typeName] = match;
    const required = !String(typeName).includes("?");
    fields.push({
      name,
      field_type: kotlinTypeToFieldType(typeName.trim()),
      required,
      list: /^List</.test(String(typeName).trim()),
      unique: false,
      primary_key: currentPrimaryKey
    });
    currentPrimaryKey = false;
  }

  const entityStem = roomEntityStem(className.replace(/Entity$/, ""));
  return makeCandidateRecord({
    kind: "entity",
    idHint: `entity_${entityStem}`,
    label: titleCase(entityStem),
    confidence: "high",
    sourceKind: "schema",
    provenance,
    model_name: className,
    fields,
    track: "db"
  });
}

function inferDaoCapability(daoName, methodName, queryText) {
    const entityStem = roomEntityStem(daoName.replace(/Dao$/, "").replace(/Info$/, "_info"));
  const normalizedMethod = methodName.toLowerCase();
  if (/insert|upsert|save|create/.test(normalizedMethod)) return `cap_create_${entityStem}`;
  if (/getall|list|fetchall/.test(normalizedMethod)) return `cap_list_${entityStem}s`;
  if (/get|fetch|load/.test(normalizedMethod)) return `cap_get_${entityStem}`;
  if (/delete|remove/.test(normalizedMethod)) return `cap_delete_${entityStem}`;
  if (/update|edit/.test(normalizedMethod)) return `cap_update_${entityStem}`;
  if (/select \*/i.test(queryText || "") && /where/i.test(queryText || "")) return `cap_get_${entityStem}`;
  if (/select \*/i.test(queryText || "")) return `cap_list_${entityStem}s`;
  return null;
}

function parseDaoFile(text, provenance) {
  const daoMatch = String(text || "").match(/@Dao[\s\S]*?interface\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m);
  if (!daoMatch) return [];
  const daoName = daoMatch[1];
  const capabilities = [];
  let pendingQuery = null;
  let pendingInsert = false;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const queryMatch = line.match(/^@Query\("(.+)"\)$/);
    if (queryMatch) {
      pendingQuery = queryMatch[1];
      pendingInsert = false;
      continue;
    }
    if (/^@Insert\b/.test(line)) {
      pendingInsert = true;
      pendingQuery = null;
      continue;
    }
    const methodMatch = line.match(/fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*:\s*([A-Za-z0-9_<>,?. ]+)/);
    if (!methodMatch) continue;
    const methodName = methodMatch[1];
    const params = methodMatch[2];
    const returnType = methodMatch[3].trim();
    const entityStem = canonicalCandidateTerm(daoName.replace(/Dao$/, "").replace(/Info$/, "_info"));
    const capabilityId = pendingInsert
      ? `cap_create_${entityStem}`
      : inferDaoCapability(daoName, methodName, pendingQuery);
    if (!capabilityId) {
      pendingInsert = false;
      pendingQuery = null;
      continue;
    }
    const queryParams = [...String(params || "").matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_<>,?.]+)/g)]
      .map((entry) => ({ name: entry[1], required: !entry[2].includes("?"), type: entry[2] }));
    capabilities.push(makeCandidateRecord({
      kind: "capability",
      idHint: capabilityId,
      label: titleCase(capabilityId.replace(/^cap_/, "")),
      confidence: "medium",
      sourceKind: "schema",
      provenance,
      entity_id: `entity_${entityStem}`,
      dao_name: daoName,
      dao_method: methodName,
      query: pendingQuery,
      input_fields: queryParams.map((entry) => entry.name),
      output_fields: /^List</.test(returnType) ? [canonicalCandidateTerm(entityStem), `${canonicalCandidateTerm(entityStem)}s`] : [canonicalCandidateTerm(entityStem)],
      track: "db"
    }));
    pendingInsert = false;
    pendingQuery = null;
  }

  return capabilities;
}

export const roomExtractor = {
  id: "db.room",
  track: "db",
  detect(context) {
    const entityFiles = findPrimaryImportFiles(context.paths, (filePath) => /Entity\.kt$/i.test(filePath) || /\/entitiy\/.+\.kt$/i.test(filePath) || /\/entity\/.+\.kt$/i.test(filePath));
    const daoFiles = findPrimaryImportFiles(context.paths, (filePath) => /Dao\.kt$/i.test(filePath));
    const score = entityFiles.length > 0 && daoFiles.length > 0 ? 89 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Android Room entities and DAO interfaces"] : []
    };
  },
  extract(context) {
    const entityFiles = findPrimaryImportFiles(context.paths, (filePath) => /Entity\.kt$/i.test(filePath) || /\/entitiy\/.+\.kt$/i.test(filePath) || /\/entity\/.+\.kt$/i.test(filePath));
    const daoFiles = findPrimaryImportFiles(context.paths, (filePath) => /Dao\.kt$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    for (const filePath of entityFiles) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const parsed = parseEntityFile(context.helpers.readTextIfExists(filePath) || "", provenance);
      if (!parsed) continue;
      candidates.entities.push(parsed);
    }

    const daoCapabilities = [];
    for (const filePath of daoFiles) {
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      daoCapabilities.push(...parseDaoFile(context.helpers.readTextIfExists(filePath) || "", provenance));
    }

    if (candidates.entities.length > 0 || daoCapabilities.length > 0) {
      findings.push({
        kind: "android_room",
        entities: candidates.entities.length,
        dao_capabilities: daoCapabilities.length
      });
    }

    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.indexes = dedupeCandidateRecords(daoCapabilities, (record) => record.id_hint);
    return { findings, candidates };
  }
};
