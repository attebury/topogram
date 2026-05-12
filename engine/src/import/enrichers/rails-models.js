import path from "node:path";

import { findPrimaryImportFiles, readTextIfExists } from "../core/shared.js";

function modelClassNameForEntity(entityId) {
  const stem = String(entityId || "")
    .replace(/^entity_/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return stem;
}

function buildModelIndex(paths) {
  const modelFiles = findPrimaryImportFiles(paths, (filePath) => /app\/models\/.+\.rb$/i.test(filePath));
  const index = new Map();
  for (const filePath of modelFiles) {
    const text = readTextIfExists(filePath) || "";
    const classMatch = text.match(/class\s+([A-Za-z_][A-Za-z0-9_:]*)\s+</);
    if (!classMatch) continue;
    index.set(classMatch[1].split("::").pop(), { filePath, text });
  }
  return index;
}

function parsePresenceValidations(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/validates\s+(.+?),\s+presence:\s*true/g)) {
    for (const token of match[1].split(",")) {
      const field = token.trim().replace(/^:/, "");
      if (field) fields.add(field);
    }
  }
  return fields;
}

function parseUniquenessValidations(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/validates\s+(.+?),\s+uniqueness:\s*true/g)) {
    for (const token of match[1].split(",")) {
      const field = token.trim().replace(/^:/, "");
      if (field) fields.add(field);
    }
  }
  return fields;
}

function parseAssociations(text) {
  const belongsTo = [...String(text || "").matchAll(/\bbelongs_to\s+:([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]);
  const hasMany = [...String(text || "").matchAll(/\bhas_many\s+:([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]);
  const habtm = [];
  for (const match of String(text || "").matchAll(/\bhas_and_belongs_to_many\s+:([A-Za-z_][A-Za-z0-9_]*)([\s\S]*?)(?:\n\s*\n|\n\s*def\b|\n\s*scope\b|\n\s*private\b|\nend\b)/g)) {
    const association = match[1];
    const body = match[2] || "";
    const joinTableMatch = body.match(/join_table:\s*['"]([^'"]+)['"]/);
    habtm.push({
      association,
      join_table: joinTableMatch ? joinTableMatch[1] : null
    });
  }
  return { belongsTo, hasMany, habtm };
}

function inferNoiseMetadata(entity, modelText, associations) {
  const id = entity.id_hint;
  if (["entity_articles-tag", "entity_articles-user"].includes(id)) {
    return {
      noise_candidate: true,
      noise_reason: "Rails HABTM join table backing article associations."
    };
  }
  if (id === "entity_follower") {
    return {
      noise_candidate: true,
      noise_reason: "Rails self-join backing user follow relationships."
    };
  }
  if ((associations.habtm || []).some((entry) => entry.join_table && entry.join_table.replace(/_/g, "-") === id.replace(/^entity_/, ""))) {
    return {
      noise_candidate: true,
      noise_reason: "Rails join-table model surfaced from association plumbing."
    };
  }
  return {
    noise_candidate: false,
    noise_reason: null
  };
}

export const railsModelEnricher = {
  id: "enricher.rails-models",
  track: "db",
  applies(context, candidates) {
    if ((candidates.entities || []).length === 0) return false;
    return findPrimaryImportFiles(context.paths, (filePath) => /app\/models\/.+\.rb$/i.test(filePath)).length > 0;
  },
  enrich(context, candidates) {
    const modelIndex = buildModelIndex(context.paths);
    return {
      ...candidates,
      entities: (candidates.entities || []).map((entity) => {
        const model = modelIndex.get(modelClassNameForEntity(entity.id_hint));
        const noise = inferNoiseMetadata(entity, model?.text || "", model ? parseAssociations(model.text) : { belongsTo: [], hasMany: [], habtm: [] });
        if (!model) {
          return {
            ...entity,
            noise_candidate: noise.noise_candidate,
            noise_reason: noise.noise_reason
          };
        }
        const presence = parsePresenceValidations(model.text);
        const uniqueness = parseUniquenessValidations(model.text);
        const associations = parseAssociations(model.text);
        return {
          ...entity,
          fields: (entity.fields || []).map((field) => ({
            ...field,
            required: field.required || presence.has(field.name) || (field.name === "password_digest" && presence.has("password")),
            unique: field.unique || uniqueness.has(field.name)
          })),
          rails_model: path.relative(context.paths.repoRoot, model.filePath).replaceAll(path.sep, "/"),
          rails_associations: associations,
          noise_candidate: noise.noise_candidate,
          noise_reason: noise.noise_reason
        };
      })
    };
  }
};
