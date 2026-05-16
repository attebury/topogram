import { dedupeCandidateRecords, findPrimaryImportFiles, makeCandidateRecord, relativeTo, selectPreferredImportFiles, slugify, titleCase, idHintify, canonicalCandidateTerm } from "../../core/shared.js";
import { parseSqlSchema } from "./sql.js";

function classifyNoiseEntity(tableName, fields) {
  const normalized = String(tableName || "").toLowerCase();
  const idLikeFields = (fields || []).filter((field) => /_id$/.test(field.name));
  if (/(^|_)(association|join|junction|link|mapping|relationship|xref)$/.test(normalized)) {
    return {
      noise_candidate: true,
      noise_reason: "Spring MyBatis implementation-noise join table."
    };
  }
  if (idLikeFields.length >= 2 && (fields || []).length <= 4) {
    return {
      noise_candidate: true,
      noise_reason: "Spring MyBatis implementation-noise join table."
    };
  }
  return {
    noise_candidate: false,
    noise_reason: null
  };
}

function isUsableMapperTableName(tableName) {
  const normalized = String(tableName || "").trim().toLowerCase();
  return normalized && !["id", "name", "count"].includes(normalized);
}

export const myBatisXmlExtractor = {
  id: "db.mybatis-xml",
  track: "db",
  detect(context) {
    const mapperFiles = findPrimaryImportFiles(context.paths, (filePath) => /\/mapper\/.+\.xml$/i.test(filePath));
    return {
      score: mapperFiles.length > 0 ? 86 : 0,
      reasons: mapperFiles.length > 0 ? ["Found MyBatis mapper XML files"] : []
    };
  },
  extract(context) {
    const mapperFiles = findPrimaryImportFiles(context.paths, (filePath) => /\/mapper\/.+\.xml$/i.test(filePath));
    const allSqlFiles = findPrimaryImportFiles(context.paths, (filePath) => filePath.endsWith(".sql"));
    const schemaSqlFiles = allSqlFiles.filter((filePath) => !/\/src\/test\//i.test(filePath));
    const sqlFiles = selectPreferredImportFiles(context.paths, schemaSqlFiles, "sql");
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    if (mapperFiles.length === 0) {
      return { findings, candidates };
    }

    const seenTableNames = new Set();
    for (const filePath of sqlFiles) {
      const parsed = parseSqlSchema(context.helpers.readTextIfExists(filePath) || "");
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      findings.push({
        kind: "mybatis_schema",
        file: provenance,
        entity_count: parsed.entities.length,
        relation_count: parsed.relations.length
      });

      for (const entity of parsed.entities) {
        const tableName = entity.table_name || entity.name;
        seenTableNames.add(tableName);
        const noise = classifyNoiseEntity(tableName, entity.fields);
        candidates.entities.push(makeCandidateRecord({
          kind: "entity",
          idHint: `entity_${slugify(entity.name)}`,
          label: titleCase(entity.name),
          confidence: "high",
          sourceKind: "schema",
          provenance,
          table_name: tableName,
          fields: entity.fields,
          noise_candidate: noise.noise_candidate,
          noise_reason: noise.noise_reason,
          track: "db"
        }));
      }

      candidates.relations.push(...parsed.relations.map((relation) => makeCandidateRecord({
        kind: "relation",
        idHint: slugify(`${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`),
        label: `${relation.from_entity} -> ${relation.to_entity}`,
        confidence: "medium",
        sourceKind: "schema",
        provenance,
        ...relation,
        track: "db"
      })));

      candidates.indexes.push(...parsed.indexes.map((index) => makeCandidateRecord({
        kind: "index",
        idHint: index.id_hint || idHintify(index.entity),
        label: titleCase((index.id_hint || index.entity || "").replace(/^index_/, "")),
        confidence: "medium",
        sourceKind: "schema",
        provenance,
        entity: index.entity,
        fields: index.fields,
        unique: index.unique,
        track: "db"
      })));
    }

    for (const filePath of mapperFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const namespace = text.match(/<mapper\s+namespace="([^"]+)"/)?.[1] || "";
      const mapperStem = namespace.split(".").pop()?.replace(/Mapper$|ReadService$/i, "") || filePath.split("/").pop()?.replace(/\.xml$/, "") || "";
      const tableMatches = [...text.matchAll(/\b(?:from|into|update|join)\s+([a-z_][a-z0-9_]*)\b/gi)].map((entry) => entry[1]);
      for (const tableName of tableMatches) {
        if (!isUsableMapperTableName(tableName)) continue;
        if (seenTableNames.has(tableName)) continue;
        const stem = canonicalCandidateTerm(tableName);
        const noise = classifyNoiseEntity(tableName, []);
        candidates.entities.push(makeCandidateRecord({
          kind: "entity",
          idHint: `entity_${slugify(stem)}`,
          label: titleCase(mapperStem || stem),
          confidence: "medium",
          sourceKind: "mapper_code",
          provenance,
          table_name: tableName,
          fields: [],
          noise_candidate: noise.noise_candidate,
          noise_reason: noise.noise_reason,
          track: "db"
        }));
        seenTableNames.add(tableName);
      }
    }

    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    candidates.indexes = dedupeCandidateRecords(candidates.indexes, (record) => record.id_hint);
    return { findings, candidates };
  }
};
