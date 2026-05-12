import path from "node:path";

import { findPrimaryImportFiles, readTextIfExists } from "../core/shared.js";

function buildControllerIndex(paths) {
  const files = findPrimaryImportFiles(paths, (filePath) => /app\/controllers\/.+_controller\.rb$/i.test(filePath));
  const index = new Map();
  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    const classMatch = text.match(/class\s+([A-Za-z_][A-Za-z0-9_:]*)\s+</);
    if (!classMatch) continue;
    const name = classMatch[1].split("::").pop().replace(/Controller$/, "").toLowerCase();
    index.set(name, { filePath, text });
  }
  return index;
}

function extractMethodBlock(text, methodName) {
  const lines = String(text || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(new RegExp(`^\\s*def\\s+${methodName}\\b`)));
  if (start === -1) return "";
  const collected = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > start && line.match(/^\s*def\s+/)) break;
    if (index > start && line.match(/^\s*private\s*$/)) break;
    collected.push(line);
  }
  return collected.join("\n");
}

function extractPermittedFields(text, methodNames) {
  const fields = new Set();
  for (const methodName of methodNames) {
    const block = extractMethodBlock(text, methodName);
    for (const match of block.matchAll(/permit\(([\s\S]*?)\)/g)) {
      for (const token of match[1].split(",")) {
        const trimmed = token.trim();
        const direct = trimmed.replace(/^:/, "").replace(/\s*=>.*$/, "");
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(direct)) {
          fields.add(direct);
        }
        const listMatch = trimmed.match(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\[\s*\]/);
        if (listMatch) {
          fields.add(listMatch[1]);
        }
      }
    }
  }
  return [...fields].sort();
}

function extractRenderJsonFields(text, methodName) {
  const block = extractMethodBlock(text, methodName);
  const fields = new Set();
  for (const match of block.matchAll(/render\s+json:\s*\{([\s\S]*?)\}/g)) {
    for (const keyMatch of match[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*):/g)) {
      fields.add(keyMatch[1]);
    }
  }
  return [...fields].sort();
}

function authHintForControllerAction(controllerText, actionName) {
  const actionBlock = extractMethodBlock(controllerText, actionName);
  const skippedMatch = controllerText.match(/skip_before_action\s+:authorize_request,\s+only:\s+\[([^\]]+)\]/);
  const skippedActions = skippedMatch ? [...skippedMatch[1].matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((entry) => entry[1]) : [];
  if (skippedActions.includes(actionName)) {
    return "public";
  }
  if (/skip_before_action\s+:authorize_request(?!,)/.test(controllerText)) {
    return "public";
  }
  if (/authorize_request/.test(controllerText) || /@current_user/.test(actionBlock)) {
    return "secured";
  }
  return "unknown";
}

function targetStateForCapability(capabilityId) {
  if (capabilityId === "cap_sign_in_account") return "authenticated";
  if (capabilityId === "cap_create_user") return "registered";
  if (capabilityId === "cap_follow_profile") return "following";
  if (capabilityId === "cap_unfollow_profile") return "not_following";
  if (capabilityId === "cap_favorite_article") return "favorited";
  if (capabilityId === "cap_unfavorite_article") return "not_favorited";
  return null;
}

function extraRailsCapabilityMetadata(capabilityId) {
  const table = {
    cap_sign_in_account: {
      output_fields: ["token", "email", "username", "bio", "image"]
    },
    cap_create_user: {
      output_fields: ["user"]
    },
    cap_get_user: {
      output_fields: ["user"]
    },
    cap_update_user: {
      output_fields: ["user"]
    },
    cap_list_articles: {
      query_params: ["offset", "limit", "tag", "author", "favorited"],
      output_fields: ["articles", "articlesCount"]
    },
    cap_feed_article: {
      output_fields: ["articles", "articlesCount"]
    },
    cap_create_article: {
      output_fields: ["article"]
    },
    cap_get_article: {
      output_fields: ["article"]
    },
    cap_update_article: {
      output_fields: ["article"]
    },
    cap_favorite_article: {
      output_fields: ["article"]
    },
    cap_unfavorite_article: {
      output_fields: ["article"]
    },
    cap_list_comments: {
      output_fields: ["comments"]
    },
    cap_create_comment: {
      output_fields: ["body", "author", "following"]
    },
    cap_get_profile: {
      output_fields: ["profile"]
    },
    cap_follow_profile: {
      output_fields: ["profile"]
    },
    cap_unfollow_profile: {
      output_fields: ["profile"]
    },
    cap_list_tags: {
      output_fields: ["tags"]
    }
  };
  return table[capabilityId] || {};
}

function controllerKeyForCapability(capabilityId) {
  if (capabilityId.includes("_article")) return "articles";
  if (capabilityId.includes("_comment")) return "comments";
  if (capabilityId.includes("_profile")) return "profiles";
  if (capabilityId.includes("_tag")) return "tags";
  if (capabilityId.includes("_user")) return "users";
  if (capabilityId.includes("_account")) return "authentication";
  return null;
}

function actionNameForCapability(capabilityId) {
  const table = {
    cap_sign_in_account: "login",
    cap_get_user: "current",
    cap_create_user: "create",
    cap_update_user: "custom_update",
    cap_list_articles: "index",
    cap_create_article: "create",
    cap_get_article: "show",
    cap_update_article: "update",
    cap_delete_article: "destroy",
    cap_favorite_article: "favorite",
    cap_unfavorite_article: "unfavorite",
    cap_feed_article: "feed",
    cap_list_comments: "index",
    cap_create_comment: "create",
    cap_delete_comment: "destroy",
    cap_get_profile: "show",
    cap_follow_profile: "follow",
    cap_unfollow_profile: "unfollow",
    cap_list_tags: "index"
  };
  return table[capabilityId] || null;
}

export const railsControllerEnricher = {
  id: "enricher.rails-controllers",
  track: "api",
  applies(context, candidates) {
    if ((candidates.capabilities || []).length === 0) return false;
    return (candidates.stacks || []).includes("rails") ||
      findPrimaryImportFiles(context.paths, (filePath) => /app\/controllers\/.+_controller\.rb$/i.test(filePath)).length > 0;
  },
  enrich(context, candidates) {
    const controllers = buildControllerIndex(context.paths);
    return {
      ...candidates,
      capabilities: (candidates.capabilities || []).map((capability) => {
        const controllerKey = controllerKeyForCapability(capability.id_hint);
        const actionName = actionNameForCapability(capability.id_hint);
        const controller = controllerKey ? controllers.get(controllerKey) : null;
        if (!controller || !actionName) {
          return capability;
        }
        const inputMethodNames = controllerKey === "articles" ? ["article_params"] : controllerKey === "users" ? ["user_params"] : [];
        const inputFields = new Set(capability.input_fields || []);
        const queryParams = new Set((capability.query_params || []).map((entry) => entry.name));
        for (const field of extractPermittedFields(controller.text, inputMethodNames)) {
          inputFields.add(field);
        }
        if (capability.id_hint === "cap_sign_in_account") {
          inputFields.add("email");
          inputFields.add("password");
        }
        if (capability.id_hint === "cap_create_comment") {
          inputFields.add("body");
        }
        const outputFields = new Set(capability.output_fields || []);
        for (const field of extractRenderJsonFields(controller.text, actionName)) {
          outputFields.add(field);
        }
        const extras = extraRailsCapabilityMetadata(capability.id_hint);
        for (const field of extras.output_fields || []) {
          outputFields.add(field);
        }
        for (const field of extras.query_params || []) {
          queryParams.add(field);
        }
        const authHint = capability.auth_hint === "unknown"
          ? authHintForControllerAction(controller.text, actionName)
          : capability.auth_hint;
        return {
          ...capability,
          auth_hint: authHint,
          input_fields: [...inputFields].sort(),
          query_params: [...queryParams].sort().map((name) => ({ name, required: false, type: null })),
          output_fields: [...outputFields].sort(),
          target_state: capability.target_state || targetStateForCapability(capability.id_hint),
          actor_hints:
            capability.actor_hints ||
            (authHint === "secured" ? ["user"] : authHint === "public" ? ["anonymous"] : []),
          provenance: [
            ...new Set([...(capability.provenance || []), path.relative(context.paths.repoRoot, controller.filePath).replaceAll(path.sep, "/")])
          ]
        };
      })
    };
  }
};
