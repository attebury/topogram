import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
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
  if (/\/Pages\/Basket\/Index\.cshtml$/.test(normalized)) return { screenId: "basket", conceptId: "surface_basket", entityId: "entity_basket", routePath: "/basket", screenKind: "list" };
  if (/\/Pages\/Basket\/Checkout\.cshtml$/.test(normalized)) return { screenId: "basket_checkout", conceptId: "surface_basket", entityId: "entity_basket", routePath: "/basket/checkout", screenKind: "form" };
  if (/\/Pages\/Basket\/Success\.cshtml$/.test(normalized)) return { screenId: "basket_success", conceptId: "surface_basket", entityId: "entity_basket", routePath: "/basket/success", screenKind: "detail" };
  if (/\/Pages\/Admin\/Index\.cshtml$/.test(normalized)) return { screenId: "catalog_item_admin", conceptId: "surface_catalog_item_admin", entityId: "entity_catalog-item", routePath: "/admin", screenKind: "list" };
  if (/\/Pages\/Admin\/EditCatalogItem\.cshtml$/.test(normalized)) return { screenId: "catalog_item_admin_edit", conceptId: "surface_catalog_item_admin", entityId: "entity_catalog-item", routePath: "/admin/edit-catalog-item", screenKind: "form" };
  if (/\/Pages\/Index\.cshtml$/.test(normalized)) return { screenId: "catalog_home", conceptId: "surface_catalog", entityId: "entity_item", routePath: "/", screenKind: "list" };
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
  if (/\/Views\/Order\/MyOrders\.cshtml$/.test(normalized)) return { screenId: "order_list", conceptId: "surface_order", entityId: "entity_order", routePath: "/order/my-orders", screenKind: "list" };
  if (/\/Views\/Order\/Detail\.cshtml$/.test(normalized)) return { screenId: "order_detail", conceptId: "surface_order", entityId: "entity_order", routePath: "/order/detail", screenKind: "detail" };
  if (/\/Views\/Manage\//.test(normalized)) {
    const base = normalized.split("/").pop()?.replace(/\.cshtml$/i, "") || "manage";
    const stem = idHintify(canonicalCandidateTerm(base.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
    return { screenId: stem, conceptId: "surface_account", entityId: null, routePath: `/manage/${stem.replace(/_/g, "-")}`, screenKind: "settings" };
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
  if (/asp-page-handler="Update"|name="updatebutton"/.test(source)) hints.push("cap_update_basket");
  if (/asp-page="\.\/Checkout"|Checkout/.test(source) && /basket/i.test(screenId)) hints.push("cap_checkout_basket");
  if (/asp-controller="Order"\s+asp-action="Detail"|Order\/Detail/.test(source)) hints.push("cap_get_order");
  if (/asp-controller="Order"\s+asp-action="cancel"/i.test(source)) hints.push("cap_cancel_order");
  if (/method="post"/.test(source) && /login/i.test(repoRelativePath)) hints.push("cap_sign_in_account");
  if (/method="post"/.test(source) && /register/i.test(repoRelativePath)) hints.push("cap_register_account");
  if (/EditCatalogItem|asp-page="\/Admin\/EditCatalogItem"/.test(source)) hints.push("cap_update_catalog_item");
  if (/Products|CatalogItem|ProductName/.test(source) && /catalog|admin/i.test(repoRelativePath)) hints.push("cap_list_catalog_items");
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
    const files = findImportFiles(context.paths, (filePath) => /\.cshtml$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath));
    const score = files.length > 0 ? 84 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Razor Pages / MVC .cshtml views"] : []
    };
  },
  extract(context) {
    const files = findImportFiles(context.paths, (filePath) => /\.cshtml$/i.test(filePath))
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
          kind: "ui_navigation",
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
