import path from "node:path";

import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function splitClassBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const classMatch = line.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/);
    if (classMatch) {
      if (current) {
        blocks.push(current);
      }
      current = {
        name: classMatch[1],
        bases: classMatch[2],
        lines: [line]
      };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }
  return blocks;
}

function collectModelAssignments(lines) {
  const assignments = [];
  let current = null;
  let balance = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!current) {
      const match = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*models\.([A-Za-z_][A-Za-z0-9_]*)\((.*)$/);
      if (!match) continue;
      current = {
        fieldName: match[1],
        fieldType: match[2],
        raw: match[3]
      };
      balance = (match[3].match(/\(/g) || []).length - (match[3].match(/\)/g) || []).length + 1;
      if (balance <= 0) {
        assignments.push(current);
        current = null;
        balance = 0;
      }
      continue;
    }

    current.raw += `\n${line}`;
    balance += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    if (balance <= 0) {
      assignments.push(current);
      current = null;
      balance = 0;
    }
  }

  return assignments;
}

function extractRelatedModel(rawArgs, currentClassName) {
  const quoted = String(rawArgs || "").match(/^\s*['"]([^'"]+)['"]/);
  const bare = String(rawArgs || "").match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*(?:,|\))/);
  const value = quoted?.[1] || bare?.[1] || null;
  if (!value) return null;
  if (value === "self") {
    return currentClassName;
  }
  const modelName = value.split(".").pop();
  return modelName || null;
}

function normalizeFieldType(fieldType, relatedModel) {
  const normalized = String(fieldType || "").toLowerCase();
  if (normalized === "charfield" || normalized === "textfield" || normalized === "slugfield" || normalized === "emailfield" || normalized === "urlfield") {
    return "string";
  }
  if (normalized === "booleanfield") {
    return "boolean";
  }
  if (normalized === "integerfield" || normalized === "autofield" || normalized === "bigintegerfield") {
    return "int";
  }
  if (normalized === "datetimefield") {
    return "datetime";
  }
  if (["foreignkey", "onetoonefield", "manytomanyfield"].includes(normalized) && relatedModel) {
    return idHintify(relatedModel);
  }
  return normalized.replace(/field$/, "") || normalized;
}

function parseModelClass(block, provenance) {
  const body = block.lines.join("\n");
  if (/class\s+Meta\s*:[\s\S]*?abstract\s*=\s*True/.test(body)) {
    return null;
  }
  const assignments = collectModelAssignments(block.lines.slice(1));
  if (assignments.length === 0) {
    return null;
  }

  const entityStem = canonicalCandidateTerm(block.name);
  const entityId = `entity_${entityStem}`;
  const fields = [];
  const relations = [];

  for (const assignment of assignments) {
    const relatedModel = extractRelatedModel(assignment.raw, block.name);
    const normalizedType = String(assignment.fieldType || "").toLowerCase();
    const required = !/blank\s*=\s*True/.test(assignment.raw) && !/null\s*=\s*True/.test(assignment.raw);
    const unique = /unique\s*=\s*True/.test(assignment.raw);
    const list = normalizedType === "manytomanyfield";
    const primaryKey = /primary_key\s*=\s*True/.test(assignment.raw);

    fields.push({
      name: assignment.fieldName,
      field_type: normalizeFieldType(assignment.fieldType, relatedModel),
      required,
      list,
      unique,
      primary_key: primaryKey
    });

    if (["foreignkey", "onetoonefield", "manytomanyfield"].includes(normalizedType) && relatedModel) {
      relations.push({
        from_entity: entityId,
        to_entity: `entity_${canonicalCandidateTerm(relatedModel)}`,
        relation_field: assignment.fieldName,
        fields: [assignment.fieldName],
        references: ["id"],
        relation_type: normalizedType
      });
    }
  }

  return {
    entity: {
      id_hint: entityId,
      label: titleCase(entityStem),
      model_name: block.name,
      django_bases: block.bases.split(",").map((entry) => entry.trim()).filter(Boolean),
      fields,
      track: "db",
      provenance
    },
    relations
  };
}

export const djangoModelsExtractor = {
  id: "db.django-models",
  track: "db",
  detect(context) {
    const modelFiles = findImportFiles(context.paths, (filePath) => /\/models\.py$/i.test(filePath));
    const manageFiles = findImportFiles(context.paths, (filePath) => /\/manage\.py$/i.test(filePath));
    const score = modelFiles.length > 0 && manageFiles.length > 0 ? 91 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Django manage.py and app models.py files"] : []
    };
  },
  extract(context) {
    const modelFiles = findImportFiles(context.paths, (filePath) => /\/models\.py$/i.test(filePath));
    const findings = [];
    const candidates = { entities: [], enums: [], relations: [], indexes: [] };

    for (const filePath of modelFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const provenance = relativeTo(context.paths.repoRoot, filePath);
      const blocks = splitClassBlocks(text);
      let entityCount = 0;

      for (const block of blocks) {
        const parsed = parseModelClass(block, provenance);
        if (!parsed) continue;
        entityCount += 1;
        candidates.entities.push(makeCandidateRecord({
          kind: "entity",
          idHint: parsed.entity.id_hint,
          label: parsed.entity.label,
          confidence: "high",
          sourceKind: "schema",
          provenance,
          model_name: parsed.entity.model_name,
          django_bases: parsed.entity.django_bases,
          fields: parsed.entity.fields,
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

      if (entityCount > 0) {
        findings.push({
          kind: "django_models",
          file: provenance,
          entity_count: entityCount
        });
      }
    }

    candidates.entities = dedupeCandidateRecords(candidates.entities, (record) => record.id_hint);
    candidates.relations = dedupeCandidateRecords(candidates.relations, (record) => record.id_hint);
    return { findings, candidates };
  }
};
