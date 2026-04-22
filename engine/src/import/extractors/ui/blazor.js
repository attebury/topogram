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
  return /\/obj\/|\/bin\/|\/wwwroot\/|\/_Imports\.razor$/.test(filePath);
}

function parsePageRoutes(text) {
  return [...String(text || "").matchAll(/@page\s+"([^"]+)"/g)].map((match) => match[1]);
}

function screenIdFromFile(filePath) {
  const base = filePath.split("/").pop()?.replace(/\.razor(?:\.cs)?$/i, "") || "screen";
  if (/^List$/i.test(base)) return "catalog_item_list";
  if (/^Create$/i.test(base)) return "catalog_item_create";
  if (/^Edit$/i.test(base)) return "catalog_item_edit";
  if (/^Delete$/i.test(base)) return "catalog_item_delete";
  if (/^Details$/i.test(base)) return "catalog_item_detail";
  if (/^Logout$/i.test(base)) return "account_logout";
  return idHintify(canonicalCandidateTerm(base.replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
}

function screenKindFromId(screenId) {
  if (/list/.test(screenId)) return "list";
  if (/detail/.test(screenId)) return "detail";
  if (/create|edit|delete/.test(screenId)) return "form";
  if (/logout|login|account/.test(screenId)) return "auth";
  return "flow";
}

function conceptIdFromScreenId(screenId) {
  if (/catalog_item/.test(screenId)) return "surface_catalog_item";
  if (/account|logout/.test(screenId)) return "surface_account";
  return `surface_${screenId}`;
}

function entityIdFromScreenId(screenId) {
  if (/catalog_item/.test(screenId)) return "entity_catalog-item";
  return null;
}

function routePathForScreen(screenId, explicitRoutes) {
  if (explicitRoutes.length > 0) return explicitRoutes[0];
  if (screenId === "catalog_item_create") return "/admin/catalog-items/create";
  if (screenId === "catalog_item_edit") return "/admin/catalog-items/:id/edit";
  if (screenId === "catalog_item_delete") return "/admin/catalog-items/:id/delete";
  if (screenId === "catalog_item_detail") return "/admin/catalog-items/:id";
  if (screenId === "catalog_item_list") return "/admin";
  if (screenId === "account_logout") return "/logout";
  return `/${screenId.replace(/_/g, "-")}`;
}

function capabilityHintsForText(text) {
  const source = String(text || "");
  const hints = [];
  if (/\bCatalogItemService\.List\s*\(/.test(source)) hints.push("cap_list_catalog_items");
  if (/\bCatalogItemService\.GetById\s*\(/.test(source)) hints.push("cap_get_catalog_item");
  if (/\bCatalogItemService\.Create\s*\(/.test(source)) hints.push("cap_create_catalog_item");
  if (/\bCatalogItemService\.Edit\s*\(/.test(source)) hints.push("cap_update_catalog_item");
  if (/\bCatalogItemService\.Delete\s*\(/.test(source)) hints.push("cap_delete_catalog_item");
  if (/\bPostAsync\(\s*"User\/Logout"/.test(source) || /\bRouteOutside\(\s*"\/Identity\/Account\/Login"/.test(source)) {
    hints.push("cap_sign_out_account");
  }
  return [...new Set(hints)];
}

function combinedComponentText(context, filePath, markupText) {
  const codeBehindPath = `${filePath}.cs`;
  const codeBehindText = context.helpers.readTextIfExists(codeBehindPath) || "";
  return `${markupText || ""}\n${codeBehindText}`;
}

function blazorLayoutSummary(text) {
  const source = String(text || "");
  return {
    shellKind:
      /<AuthorizeRouteView\b/.test(source) ? "authenticated_app"
      : /<Router\b/.test(source) ? "topbar"
      : null,
    patterns: [
      ...new Set([
        /<Router\b/.test(source) ? "route_table" : null,
        /<AuthorizeRouteView\b/.test(source) ? "authenticated_routes" : null,
        /<CascadingAuthenticationState\b/.test(source) ? "auth_state" : null
      ].filter(Boolean))
    ]
  };
}

export const blazorUiExtractor = {
  id: "ui.blazor",
  track: "ui",
  detect(context) {
    const razorFiles = findImportFiles(context.paths, (filePath) => /\.razor$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath));
    const score = razorFiles.length > 0 ? 86 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Blazor .razor components and pages"] : []
    };
  },
  extract(context) {
    const razorFiles = findImportFiles(context.paths, (filePath) => /\.razor$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };

    for (const filePath of razorFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const combinedText = combinedComponentText(context, filePath, text);
      const relativePath = relativeTo(context.paths.repoRoot, filePath);
      const explicitRoutes = parsePageRoutes(text);
      const baseName = filePath.split("/").pop() || "";
      const isShell = /\/App\.razor$/.test(filePath);
      const isComponent = /\/Pages\/|\/Shared\//.test(filePath);
      if (!isShell && !isComponent) continue;

      if (isShell) {
        const summary = blazorLayoutSummary(text);
        if (summary.shellKind) {
          candidates.actions.push(makeCandidateRecord({
            kind: "ui_shell",
            idHint: `blazor_${idHintify(summary.shellKind)}_shell`,
            label: titleCase(summary.shellKind),
            confidence: "medium",
            sourceKind: "layout_code",
            provenance: relativePath,
            track: "ui",
            shell_kind: summary.shellKind
          }));
        }
        for (const pattern of summary.patterns) {
          candidates.actions.push(makeCandidateRecord({
            kind: "ui_navigation",
            idHint: `blazor_${idHintify(pattern)}`,
            label: pattern,
            confidence: "medium",
            sourceKind: "layout_code",
            provenance: relativePath,
            track: "ui",
            navigation_pattern: pattern
          }));
        }
        continue;
      }

      if (/^(MainLayout|NavMenu|RedirectToLogin|Spinner|Toast|CustomInputSelect)\.razor$/i.test(baseName)) continue;

      const screenId = screenIdFromFile(filePath);
      const conceptId = conceptIdFromScreenId(screenId);
      const entityId = entityIdFromScreenId(screenId);
      const routePath = routePathForScreen(screenId, explicitRoutes);
      const provenance = relativePath;
      const capabilityHints = capabilityHintsForText(combinedText);

      candidates.screens.push(makeCandidateRecord({
        kind: "screen",
        idHint: screenId,
        label: titleCase(screenId),
        confidence: explicitRoutes.length > 0 ? "high" : "medium",
        sourceKind: explicitRoutes.length > 0 ? "route_code" : "component_code",
        provenance,
        track: "ui",
        entity_id: entityId,
        concept_id: conceptId,
        screen_kind: screenKindFromId(screenId),
        route_path: routePath,
        capability_hints: capabilityHints
      }));

      candidates.routes.push(makeCandidateRecord({
        kind: "ui_route",
        idHint: `${screenId}_route`,
        label: routePath,
        confidence: explicitRoutes.length > 0 ? "high" : "medium",
        sourceKind: explicitRoutes.length > 0 ? "route_code" : "component_code",
        provenance,
        track: "ui",
        screen_id: screenId,
        entity_id: entityId,
        concept_id: conceptId,
        path: routePath
      }));

      for (const capabilityHint of capabilityHints) {
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_action",
          idHint: `${screenId}_${idHintify(capabilityHint)}`,
          label: capabilityHint,
          confidence: "medium",
          sourceKind: "component_code",
          provenance,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: conceptId,
          capability_hint: capabilityHint,
          prominence: /create|update|delete|sign_out/.test(capabilityHint) ? "primary" : "secondary"
        }));
      }

      findings.push({
        kind: "blazor_component",
        file: relativePath,
        screen_id: screenId,
        route_count: explicitRoutes.length
      });
    }

    if (candidates.screens.length > 0) {
      candidates.stacks.push("blazor");
    }

    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
