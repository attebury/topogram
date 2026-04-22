import path from "node:path";

import { findImportFiles, readTextIfExists } from "../core/shared.js";

function splitClassBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let current = null;
  let headerLines = null;

  for (const line of lines) {
    if (headerLines) {
      headerLines.push(line);
      if (line.includes("):")) {
        const header = headerLines.join(" ");
        const match = header.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*:/);
        if (match) {
          if (current) blocks.push(current);
          current = {
            name: match[1],
            bases: match[2],
            lines: [...headerLines]
          };
        }
        headerLines = null;
      }
      continue;
    }

    const match = line.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/);
    if (match) {
      if (current) blocks.push(current);
      current = {
        name: match[1],
        bases: match[2],
        lines: [line]
      };
      continue;
    }

    if (/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.test(line)) {
      headerLines = [line];
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) blocks.push(current);
  return blocks;
}

function buildSerializerIndex(paths) {
  const files = findImportFiles(paths, (filePath) => /\/serializers\.py$/i.test(filePath));
  const index = new Map();

  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    for (const block of splitClassBlocks(text)) {
      const body = block.lines.join("\n");
      const explicitFields = [...body.matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:serializers\.)?([A-Za-z_][A-Za-z0-9_]*)\(/gm)]
        .map((entry) => ({
          name: entry[1],
          writeOnly: new RegExp(`${entry[1]}\\s*=\\s*[\\s\\S]{0,120}?write_only\\s*=\\s*True`).test(body),
          readOnly: new RegExp(`${entry[1]}\\s*=\\s*[\\s\\S]{0,120}?read_only\\s*=\\s*True`).test(body)
        }));
      const metaFieldsMatch = body.match(/fields\s*=\s*\(([\s\S]*?)\)/m);
      const metaFields = metaFieldsMatch
        ? [...metaFieldsMatch[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((entry) => entry[1] || entry[2])
        : [];
      const readOnlyMatch = body.match(/read_only_fields\s*=\s*\(([\s\S]*?)\)/m);
      const readOnlyFields = new Set(readOnlyMatch
        ? [...readOnlyMatch[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((entry) => entry[1] || entry[2])
        : []);
      const writeOnlyFields = new Set(explicitFields.filter((field) => field.writeOnly).map((field) => field.name));
      const allFields = [...new Set([...metaFields, ...explicitFields.map((field) => field.name)])];
      const inputFields = allFields.filter((field) => !readOnlyFields.has(field) && !explicitFields.find((entry) => entry.name === field && entry.readOnly));
      const outputFields = allFields.filter((field) => !writeOnlyFields.has(field));

      index.set(block.name, {
        filePath,
        input_fields: [...new Set(inputFields)].sort(),
        output_fields: [...new Set(outputFields)].sort()
      });
    }
  }

  return index;
}

function buildViewIndex(paths) {
  const files = findImportFiles(paths, (filePath) => /\/views\.py$/i.test(filePath));
  const index = new Map();

  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    for (const block of splitClassBlocks(text)) {
      const body = block.lines.join("\n");
      const queryParams = [...new Set([...body.matchAll(/query_params\.get\(\s*['"]([^'"]+)['"]/g)].map((entry) => entry[1]))].sort();
      index.set(block.name, {
        filePath,
        query_params: queryParams
      });
    }
  }

  return index;
}

function extraCapabilityMetadata(capabilityId) {
  const table = {
    cap_sign_in_account: {
      input_fields: ["email", "password"],
      output_fields: ["user", "token", "email", "username"],
      target_state: "authenticated"
    },
    cap_create_user: {
      input_fields: ["email", "username", "password"],
      output_fields: ["user"],
      target_state: "registered"
    },
    cap_get_user: {
      output_fields: ["user"]
    },
    cap_update_user: {
      input_fields: ["email", "username", "password", "bio", "image"],
      output_fields: ["user"]
    },
    cap_list_articles: {
      output_fields: ["articles", "articlesCount"]
    },
    cap_feed_article: {
      output_fields: ["articles", "articlesCount"]
    },
    cap_create_article: {
      input_fields: ["title", "description", "body", "tagList"],
      output_fields: ["article"]
    },
    cap_get_article: {
      output_fields: ["article"]
    },
    cap_update_article: {
      input_fields: ["title", "description", "body", "tagList", "slug"],
      output_fields: ["article"]
    },
    cap_favorite_article: {
      output_fields: ["article"],
      target_state: "favorited"
    },
    cap_unfavorite_article: {
      output_fields: ["article"],
      target_state: "not_favorited"
    },
    cap_list_comments: {
      output_fields: ["comments"]
    },
    cap_create_comment: {
      input_fields: ["body"],
      output_fields: ["comment"]
    },
    cap_get_profile: {
      output_fields: ["profile"]
    },
    cap_follow_profile: {
      output_fields: ["profile"],
      target_state: "following"
    },
    cap_unfollow_profile: {
      output_fields: ["profile"],
      target_state: "not_following"
    },
    cap_list_tags: {
      output_fields: ["tags"]
    }
  };
  return table[capabilityId] || {};
}

export const djangoRestEnricher = {
  id: "enricher.django-rest",
  track: "api",
  applies(context, candidates) {
    if ((candidates.capabilities || []).length === 0) return false;
    return (candidates.stacks || []).includes("django") ||
      findImportFiles(context.paths, (filePath) => /\/serializers\.py$/i.test(filePath)).length > 0;
  },
  enrich(context, candidates) {
    const serializerIndex = buildSerializerIndex(context.paths);
    const viewIndex = buildViewIndex(context.paths);

    return {
      ...candidates,
      capabilities: (candidates.capabilities || []).map((capability) => {
        const serializer = capability.serializer_class ? serializerIndex.get(capability.serializer_class) : null;
        const view = capability.view_class ? viewIndex.get(capability.view_class) : null;
        const extras = extraCapabilityMetadata(capability.id_hint);
        const inputFields = new Set((extras.input_fields || capability.input_fields || []));
        const outputFields = new Set(capability.output_fields || []);
        const queryParams = new Map((capability.query_params || []).map((entry) => [entry.name, entry]));
        const method = String(capability.endpoint?.method || "").toUpperCase();

        if (!["GET", "DELETE"].includes(method) && !(extras.input_fields || []).length) {
          for (const field of serializer?.input_fields || []) inputFields.add(field);
        }
        for (const field of serializer?.output_fields || []) outputFields.add(field);
        for (const field of extras.output_fields || []) outputFields.add(field);
        for (const field of view?.query_params || []) queryParams.set(field, { name: field, required: false, type: null });

        return {
          ...capability,
          input_fields: [...inputFields].sort(),
          output_fields: [...outputFields].sort(),
          query_params: [...queryParams.values()].sort((a, b) => a.name.localeCompare(b.name)),
          target_state: capability.target_state || extras.target_state || null,
          provenance: [
            ...new Set([
              ...(capability.provenance || []),
              ...(serializer ? [path.relative(context.paths.repoRoot, serializer.filePath).replaceAll(path.sep, "/")] : []),
              ...(view ? [path.relative(context.paths.repoRoot, view.filePath).replaceAll(path.sep, "/")] : [])
            ])
          ]
        };
      })
    };
  }
};
