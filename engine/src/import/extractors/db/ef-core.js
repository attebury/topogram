import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  makeCandidateRecord,
  readTextIfExists,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function splitClassBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (match) {
      if (current) blocks.push(current);
      current = { name: match[1], lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) blocks.push(current);
  return blocks;
}

function parseProperties(block) {
  const properties = [];
  const notMapped = new Set();
  let pendingNotMapped = false;

  for (const rawLine of block.lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\[NotMapped\]/.test(line)) {
      pendingNotMapped = true;
      continue;
    }
    const match = line.match(/^public\s+([A-Za-z0-9_<>\[\]\?., ]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (!match) continue;
    const [, typeName, name] = match;
    properties.push({ name, typeName: typeName.trim(), notMapped: pendingNotMapped });
    if (pendingNotMapped) {
      notMapped.add(name);
      pendingNotMapped = false;
    }
  }

  return properties;
}

function normalizeScalarType(typeName) {
  const normalized = String(typeName || "").replace(/\?$/, "").trim();
  if (["string", "byte[]"].includes(normalized)) return "string";
  if (["int", "long", "short"].includes(normalized)) return "int";
  if (["bool", "boolean"].includes(normalized.toLowerCase())) return "boolean";
  if (["DateTime", "DateTimeOffset"].includes(normalized)) return "datetime";
  return normalized;
}

function unwrapListType(typeName) {
  const listMatch = String(typeName || "").match(/List<([^>]+)>/);
  return listMatch ? listMatch[1].trim() : null;
}

function domainEntityInfo(name, properties, trackedNames) {
  const scalarFields = [];
  const relations = [];

  const entityStem =
    name === "Person" ? "user" :
    canonicalCandidateTerm(name);

  const entityId = `entity_${entityStem}`;

  const scalarLike = (typeName) => {
    const base = String(typeName || "").replace(/\?$/, "").trim();
    return ["string", "int", "long", "short", "bool", "byte[]", "DateTime", "DateTimeOffset"].includes(base);
  };

  const scalarIdOnlyCount = properties.filter((property) => /Id$/.test(property.name)).length;
  const relationReferenceCount = properties.filter((property) => {
    const base = property.typeName.replace(/\?$/, "").trim();
    return trackedNames.has(base) || trackedNames.has((unwrapListType(base) || "").trim());
  }).length;
  const relationOnlyEntity =
    properties.length > 0 &&
    scalarIdOnlyCount >= 2 &&
    relationReferenceCount >= 2 &&
    properties.every((property) => {
      const base = property.typeName.replace(/\?$/, "").trim();
      return /Id$/.test(property.name) || trackedNames.has(base) || trackedNames.has((unwrapListType(base) || "").trim());
    });

  for (const property of properties) {
    if (property.notMapped) continue;
    const baseType = property.typeName.replace(/\?$/, "").trim();
    const listType = unwrapListType(baseType);
    const required = !property.typeName.includes("?") && baseType !== "string" && baseType !== "byte[]";

    if (scalarLike(baseType)) {
      if (["Hash", "Salt"].includes(property.name)) continue;
      scalarFields.push({
        name: property.name.charAt(0).toLowerCase() + property.name.slice(1),
        field_type: normalizeScalarType(baseType),
        required: baseType !== "string" ? required : false,
        list: false,
        unique: ["Email", "Username", "Slug", "TagId"].includes(property.name),
        primary_key: /Id$/.test(property.name) && [name, "Tag"].some((part) => property.name === `${part}Id`)
      });
      continue;
    }

    if (trackedNames.has(baseType)) {
      relations.push({
        from_entity: entityId,
        to_entity: `entity_${baseType === "Person" ? "user" : canonicalCandidateTerm(baseType)}`,
        relation_field: property.name.charAt(0).toLowerCase() + property.name.slice(1),
        fields: [property.name.charAt(0).toLowerCase() + property.name.slice(1)],
        references: ["id"],
        relation_type: "reference"
      });
      continue;
    }

    if (listType && trackedNames.has(listType)) {
      relations.push({
        from_entity: entityId,
        to_entity: `entity_${listType === "Person" ? "user" : canonicalCandidateTerm(listType)}`,
        relation_field: property.name.charAt(0).toLowerCase() + property.name.slice(1),
        fields: [property.name.charAt(0).toLowerCase() + property.name.slice(1)],
        references: ["id"],
        relation_type: "collection"
      });
    }
  }

  return {
    entity: {
      id_hint: entityId,
      label: titleCase(entityStem),
      model_name: name,
      fields: scalarFields,
      noise_candidate: relationOnlyEntity,
      noise_reason: relationOnlyEntity ? "EF Core relationship-link entity inferred as implementation noise." : null
    },
    relations
  };
}

export const efCoreExtractor = {
  id: "db.ef-core",
  track: "db",
  detect(context) {
    const csprojFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.csproj$/i.test(filePath));
    const dbContextFiles = findPrimaryImportFiles(context.paths, (filePath) => /DbContext|Context\.cs$/i.test(filePath));
    const score = csprojFiles.length > 0 && dbContextFiles.some((filePath) => /DbContext/.test(readTextIfExists(filePath) || "")) ? 89 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found .NET project with EF Core DbContext"] : []
    };
  },
  extract(context) {
    const dbContextFiles = findPrimaryImportFiles(context.paths, (filePath) => /DbContext|Context\.cs$/i.test(filePath));
    const domainFiles = findPrimaryImportFiles(context.paths, (filePath) => /\/Domain\/.+\.cs$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    const trackedNames = new Set();
    for (const filePath of dbContextFiles) {
      const text = readTextIfExists(filePath) || "";
      for (const match of text.matchAll(/DbSet<([A-Za-z_][A-Za-z0-9_]*)>/g)) {
        trackedNames.add(match[1]);
      }
    }

    for (const filePath of domainFiles) {
      const text = readTextIfExists(filePath) || "";
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      for (const block of splitClassBlocks(text)) {
        if (!trackedNames.has(block.name)) continue;
        const parsed = domainEntityInfo(block.name, parseProperties(block), trackedNames);
        findings.push({
          kind: "ef_core_entity",
          file: provenance,
          entity: parsed.entity.id_hint
        });
        candidates.entities.push(makeCandidateRecord({
          kind: "entity",
          idHint: parsed.entity.id_hint,
          label: parsed.entity.label,
          confidence: "high",
          sourceKind: "schema",
          provenance,
          model_name: parsed.entity.model_name,
          fields: parsed.entity.fields,
          noise_candidate: parsed.entity.noise_candidate,
          noise_reason: parsed.entity.noise_reason,
          track: "db"
        }));
        candidates.relations.push(...parsed.relations.map((relation) => makeCandidateRecord({
          kind: "relation",
          idHint: `${relation.from_entity}_${relation.relation_field}_${relation.to_entity}`.replace(/[^a-zA-Z0-9_]+/g, "_").toLowerCase(),
          label: `${relation.from_entity} -> ${relation.to_entity}`,
          confidence: "medium",
          sourceKind: "schema",
          provenance,
          ...relation,
          track: "db"
        })));
      }
    }

    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    return { findings, candidates };
  }
};
