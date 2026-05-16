import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function shouldIgnoreFile(filePath) {
  return /\/obj\/|\/bin\/|\/_ViewImports\.cshtml$|\/_ViewStart\.cshtml$|\/Shared\/_|\/Views\/Shared\/|\/Pages\/Shared\/|\/_[^/]+\.cshtml$/.test(filePath);
}

function inferFromPath(repoRelativePath) {
  const normalized = repoRelativePath.replace(/\\/g, "/");
  if (/\/Pages\/Privacy\.cshtml$/.test(normalized)) return { screenId: "privacy", conceptId: "surface_app", entityId: null, routePath: "/privacy", screenKind: "detail" };
  if (/\/Pages\/Error\.cshtml$/.test(normalized)) return { screenId: "error", conceptId: "surface_app", entityId: null, routePath: "/error", screenKind: "detail" };
  if (/\/Areas\/Identity\/Pages\/Account\/Login\.cshtml$/.test(normalized)) return { screenId: "account_login", conceptId: "surface_account", entityId: null, routePath: "/account/login", screenKind: "auth" };
  if (/\/Areas\/Identity\/Pages\/Account\/Register\.cshtml$/.test(normalized)) return { screenId: "account_register", conceptId: "surface_account", entityId: null, routePath: "/account/register", screenKind: "auth" };
  if (/\/Areas\/Identity\/Pages\/Account\/Logout\.cshtml$/.test(normalized)) return { screenId: "account_logout_page", conceptId: "surface_account", entityId: null, routePath: "/account/logout", screenKind: "auth" };
  if (/\/Areas\/Identity\/Pages\/Account\/ConfirmEmail\.cshtml$/.test(normalized)) return { screenId: "account_confirm_email", conceptId: "surface_account", entityId: null, routePath: "/account/confirm-email", screenKind: "auth" };
  if (/\/Views\/Account\//.test(normalized)) {
    const base = normalized.split("/").pop()?.replace(/\.cshtml$/i, "") || "account";
    const stem = idHintify(canonicalCandidateTerm(base.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
    return { screenId: stem, conceptId: "surface_account", entityId: null, routePath: `/account/${stem.replace(/_/g, "-")}`, screenKind: "auth" };
  }
  if (/\/Views\/Manage\//.test(normalized)) {
    const base = normalized.split("/").pop()?.replace(/\.cshtml$/i, "") || "manage";
    const stem = idHintify(canonicalCandidateTerm(base.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
    return { screenId: stem, conceptId: "surface_account", entityId: null, routePath: `/manage/${stem.replace(/_/g, "-")}`, screenKind: "settings" };
  }
  const pageMatch = normalized.match(/\/Pages\/(.+)\.cshtml$/);
  if (pageMatch) {
    const parts = pageMatch[1]
      .split("/")
      .map((part) => idHintify(canonicalCandidateTerm(part.replace(/([a-z0-9])([A-Z])/g, "$1_$2"))))
      .filter(Boolean);
    if (parts.length > 0) {
      const isIndex = parts[parts.length - 1] === "index";
      const routeParts = isIndex ? parts.slice(0, -1) : parts;
      const screenParts = isIndex && parts.length > 1 ? parts.slice(0, -1) : parts;
      const screenId = screenParts.join("_") || "home";
      const entityStem = screenParts[0] && screenParts[0] !== "index" ? screenParts[0] : null;
      return {
        screenId,
        conceptId: `surface_${screenId}`,
        entityId: entityStem ? `entity_${entityStem}` : null,
        routePath: routeParts.length > 0 ? `/${routeParts.join("/")}`.replace(/_/g, "-") : "/",
        screenKind: /create|edit|change|checkout/.test(screenId) ? "form" : /detail|details|success/.test(screenId) ? "detail" : "list"
      };
    }
  }
  const viewMatch = normalized.match(/\/Views\/([^/]+)\/(.+)\.cshtml$/);
  if (viewMatch) {
    const controller = idHintify(canonicalCandidateTerm(viewMatch[1].replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
    const stem = idHintify(canonicalCandidateTerm(viewMatch[2].replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
    const screenId = stem === "index" ? controller : `${controller}_${stem}`;
    return {
      screenId,
      conceptId: `surface_${controller}`,
      entityId: `entity_${controller}`,
      routePath: stem === "index" ? `/${controller}` : `/${controller}/${stem.replace(/_/g, "-")}`,
      screenKind: /create|edit|change|checkout/.test(stem) ? "form" : /detail|details|show|success/.test(stem) ? "detail" : "list"
    };
  }

  const base = normalized.split("/").pop()?.replace(/\.cshtml$/i, "") || "view";
  const stem = idHintify(canonicalCandidateTerm(base.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
  return {
    screenId: stem,
    conceptId: `surface_${stem}`,
    entityId: null,
    routePath: `/${stem.replace(/_/g, "-")}`,
    screenKind: /login|register|logout|account/.test(stem) ? "auth" : /edit|checkout|change/.test(stem) ? "form" : "detail"
  };
}

function routePathForPage(text, fallback) {
  const match = String(text || "").match(/@page\s+"([^"]+)"/);
  return match ? match[1] : fallback;
}

function capabilityHints(text, repoRelativePath, screenId) {
  const source = String(text || "");
  const hints = [];
  if (/method="post"/.test(source) && /login/i.test(repoRelativePath)) hints.push("cap_sign_in_account");
  if (/method="post"/.test(source) && /register/i.test(repoRelativePath)) hints.push("cap_register_account");
  const entityStem = canonicalCandidateTerm(screenId.replace(/_(create|edit|update|delete|detail|details|list|index|checkout|success)$/i, ""));
  if (/asp-page-handler="Update"|name="updatebutton"|asp-action="Edit"|Edit/.test(source)) hints.push(`cap_update_${entityStem}`);
  if (/asp-action="Delete"|Delete/.test(source)) hints.push(`cap_delete_${entityStem}`);
  if (/asp-action="Create"|Create/.test(source)) hints.push(`cap_create_${entityStem}`);
  if (/asp-action="Detail"|Detail/.test(source)) hints.push(`cap_get_${entityStem}`);
  return [...new Set(hints)];
}

function shellPatterns(text) {
  const source = String(text || "");
  return [
    /<form\b/.test(source) ? "form_post" : null,
    /asp-page=|asp-controller=|asp-action=/.test(source) ? "server_navigation" : null
  ].filter(Boolean);
}

export const razorPagesUiExtractor = {
  id: "ui.razor-pages",
  track: "ui",
  detect(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /\.cshtml$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath));
    const score = files.length > 0 ? 84 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Razor Pages / MVC .cshtml views"] : []
    };
  },
  extract(context) {
    const files = findPrimaryImportFiles(context.paths, (filePath) => /\.cshtml$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };

    for (const filePath of files) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const repoRelativePath = relativeTo(context.paths.repoRoot, filePath);
      const inferred = inferFromPath(repoRelativePath);
      const routePath = routePathForPage(text, inferred.routePath);
      const hints = capabilityHints(text, repoRelativePath, inferred.screenId);

      candidates.screens.push(makeCandidateRecord({
        kind: "screen",
        idHint: inferred.screenId,
        label: titleCase(inferred.screenId),
        confidence: /@page|Views\//.test(repoRelativePath) ? "high" : "medium",
        sourceKind: /@page/.test(text) ? "route_code" : "view_code",
        provenance: repoRelativePath,
        track: "ui",
        entity_id: inferred.entityId,
        concept_id: inferred.conceptId,
        screen_kind: inferred.screenKind,
        route_path: routePath,
        capability_hints: hints
      }));

      candidates.routes.push(makeCandidateRecord({
        kind: "ui_route",
        idHint: `${inferred.screenId}_route`,
        label: routePath,
        confidence: /@page/.test(text) ? "high" : "medium",
        sourceKind: /@page/.test(text) ? "route_code" : "view_code",
        provenance: repoRelativePath,
        track: "ui",
        screen_id: inferred.screenId,
        entity_id: inferred.entityId,
        concept_id: inferred.conceptId,
        path: routePath
      }));

      for (const hint of hints) {
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_action",
          idHint: `${inferred.screenId}_${idHintify(hint)}`,
          label: hint,
          confidence: "medium",
          sourceKind: "view_code",
          provenance: repoRelativePath,
          track: "ui",
          screen_id: inferred.screenId,
          entity_id: inferred.entityId,
          concept_id: inferred.conceptId,
          capability_hint: hint,
          prominence: /sign|register|checkout|cancel|update/.test(hint) ? "primary" : "secondary"
        }));
      }

      for (const pattern of shellPatterns(text)) {
        candidates.actions.push(makeCandidateRecord({
          kind: "navigation",
          idHint: `razor_${idHintify(pattern)}`,
          label: pattern,
          confidence: "low",
          sourceKind: "view_code",
          provenance: repoRelativePath,
          track: "ui",
          navigation_pattern: pattern
        }));
      }

      findings.push({
        kind: "razor_view",
        file: repoRelativePath,
        screen_id: inferred.screenId
      });
    }

    if (candidates.screens.length > 0) {
      candidates.stacks.push("razor_pages");
    }

    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
