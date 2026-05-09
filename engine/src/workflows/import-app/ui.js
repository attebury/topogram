// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../path-helpers.js";
import { canonicalCandidateTerm, idHintify, titleCase } from "../../text-helpers.js";
import { listFilesRecursive, readTextIfExists } from "../shared.js";
import { dedupeCandidateRecords, makeCandidateRecord } from "./shared.js";

export function inferSvelteRoutes(rootDir) {
  const routesRoot = path.join(rootDir, "src", "routes");
  if (!fs.existsSync(routesRoot)) {
    return [];
  }
  const files = listFilesRecursive(routesRoot, (child) => child.endsWith("+page.svelte") || child.endsWith("+page.ts") || child.endsWith("+page.server.ts"));
  const routes = new Set();
  for (const filePath of files) {
    const relative = relativeTo(routesRoot, filePath)
      .replace(/(^|\/)\+page(\.server|)\.(svelte|ts)$/, "")
      .replace(/\[(.+?)\]/g, ":$1")
      .replace(/^$/, "/");
    routes.add(relative.startsWith("/") ? relative : `/${relative}`);
  }
  return [...routes].sort();
}

export function inferReactRoutes(rootDir) {
  const appPath = path.join(rootDir, "src", "App.tsx");
  const text = readTextIfExists(appPath);
  if (!text) {
    return [];
  }
  const routes = new Set();
  for (const match of text.matchAll(/path:\s*"([^"]+)"/g)) {
    routes.add(match[1]);
  }
  for (const match of text.matchAll(/path="([^"]+)"/g)) {
    routes.add(match[1]);
  }
  return [...routes].sort();
}

export function inferNextAppRoutes(rootDir) {
  const appDir = path.join(rootDir, "app");
  if (!fs.existsSync(appDir)) {
    return [];
  }
  const routeFiles = listFilesRecursive(
    appDir,
    (child) =>
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /\/route\.(tsx|ts|jsx|js)$/.test(child)
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const relative = relativeTo(appDir, filePath);
    const isPage = /\/page\.(tsx|ts|jsx|js|mdx)$/.test(`/${relative}`) || /^page\.(tsx|ts|jsx|js|mdx)$/.test(relative);
    const normalizedPath = `/${relative}`
      .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
      .replace(/\/index$/, "")
      .replace(/^\/$/, "/");
    routes.push({
      path: normalizedPath === "" ? "/" : normalizedPath,
      kind: isPage ? "page" : "route",
      file: filePath
    });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}

export function nextScreenKindForRoute(routePath) {
  const normalized = String(routePath || "");
  if (/\/(login|register|setup)$/.test(normalized)) {
    return "flow";
  }
  return screenKindForRoute(routePath);
}

export function nextScreenIdForRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") {
    return "home";
  }
  if (/\/login$/.test(normalized)) {
    return "login";
  }
  if (/\/register$/.test(normalized)) {
    return "register";
  }
  if (/\/setup$/.test(normalized)) {
    return "setup";
  }
  return screenIdForRoute(routePath);
}

export function entityIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (/^\/posts(\/|$)/.test(normalized)) {
    return "entity_post";
  }
  if (/^\/users(\/|$)/.test(normalized)) {
    return "entity_user";
  }
  return null;
}

export function conceptIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") {
    return "surface_home";
  }
  if (/\/login$/.test(normalized)) {
    return "flow_login";
  }
  if (/\/register$/.test(normalized)) {
    return "flow_register";
  }
  if (/\/setup$/.test(normalized)) {
    return "flow_setup";
  }
  return entityIdForNextRoute(routePath) || entityIdForRoute(routePath);
}

export function uiCapabilityHintsForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") {
    return { load: null, submit: null, primary_action: null };
  }
  if (/\/login$/.test(normalized)) {
    return { load: null, submit: "cap_sign_in_user", primary_action: "cap_sign_in_user" };
  }
  if (/\/register$/.test(normalized)) {
    return { load: null, submit: "cap_register_user", primary_action: "cap_register_user" };
  }
  if (/\/setup$/.test(normalized)) {
    return { load: null, submit: null, primary_action: null };
  }
  if (/^\/posts\/new$/.test(normalized)) {
    return { load: null, submit: "cap_create_post", primary_action: "cap_create_post" };
  }
  if (/^\/posts\/:id$/.test(normalized) || /^\/posts\/:[^/]+$/.test(normalized)) {
    return { load: "cap_get_post", submit: null, primary_action: "cap_update_post" };
  }
  if (/^\/posts$/.test(normalized)) {
    return { load: "cap_list_posts", submit: null, primary_action: "cap_create_post" };
  }
  if (/^\/users\/new$/.test(normalized)) {
    return { load: null, submit: "cap_create_user", primary_action: "cap_create_user" };
  }
  return uiCapabilityHintsForRoute(routePath);
}

export function routeSegments(routePath) {
  return String(routePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/^:/, ""));
}

export function screenKindForRoute(routePath) {
  const normalized = String(routePath || "");
  const segments = routeSegments(normalized);
  if (/\/new$/.test(normalized)) {
    return "form";
  }
  if (/\/:?[A-Za-z0-9_]+\/edit$/.test(normalized)) {
    return "form";
  }
  if (segments.length >= 2 && !/\/new$/.test(normalized) && !/\/edit$/.test(normalized)) {
    return "detail";
  }
  return "list";
}

export function screenIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  const resource = canonicalCandidateTerm(segments[0] || "home");
  const kind = screenKindForRoute(routePath);
  if (kind === "form" && /\/new$/.test(routePath)) {
    return `${resource}_create`;
  }
  if (kind === "form" && /\/edit$/.test(routePath)) {
    return `${resource}_edit`;
  }
  if (kind === "detail") {
    return `${resource}_detail`;
  }
  return `${resource}_list`;
}

export function uiCapabilityHintsForRoute(routePath) {
  const segments = routeSegments(routePath);
  const resource = canonicalCandidateTerm(segments[0] || "item");
  const idSegment = segments[1] || null;
  if (/\/new$/.test(routePath)) {
    return { load: null, submit: `cap_create_${resource}`, primary_action: `cap_create_${resource}` };
  }
  if (/\/edit$/.test(routePath)) {
    return { load: `cap_get_${resource}`, submit: `cap_update_${resource}`, primary_action: `cap_update_${resource}` };
  }
  if (idSegment && !/new|edit/.test(idSegment)) {
    return { load: `cap_get_${resource}`, submit: null, primary_action: `cap_update_${resource}` };
  }
  return { load: `cap_list_${resource}s`, submit: null, primary_action: `cap_create_${resource}` };
}

export function entityIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  return `entity_${canonicalCandidateTerm(segments[0] || "item")}`;
}

export function collectUiImport(paths) {
  const findings = [];
  const candidates = {
    screens: [],
    routes: [],
    actions: [],
    stacks: []
  };

  const reactRoots = [
    path.join(paths.workspaceRoot, "apps", "web"),
    path.join(paths.workspaceRoot, "examples", "maintained", "proof-app")
  ];
  const svelteRoots = [
    path.join(paths.workspaceRoot, "apps", "web-sveltekit"),
    path.join(paths.workspaceRoot, "apps", "local-stack", "web")
  ];
  const nextRoots = [paths.workspaceRoot];

  for (const rootDir of reactRoots) {
    const routes = inferReactRoutes(rootDir);
    if (routes.length === 0) {
      continue;
    }
    const provenance = relativeTo(paths.repoRoot, path.join(rootDir, "src", "App.tsx"));
    findings.push({
      kind: "react_screen_routes",
      file: provenance,
      routes
    });
    candidates.stacks.push("react_web");
    for (const routePath of routes) {
      const screenId = screenIdForRoute(routePath);
      const screenKind = screenKindForRoute(routePath);
      const capabilityHints = uiCapabilityHintsForRoute(routePath);
      candidates.screens.push(
        makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          entity_id: entityIdForRoute(routePath),
          screen_kind: screenKind,
          route_path: routePath,
          capability_hints: capabilityHints
        })
      );
      candidates.routes.push(
        makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: routePath,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          screen_id: screenId,
          entity_id: entityIdForRoute(routePath),
          path: routePath
        })
      );
      if (capabilityHints.primary_action) {
        candidates.actions.push(
          makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHints.primary_action)}`,
            label: capabilityHints.primary_action,
            confidence: "low",
            sourceKind: "route_code",
            provenance: `${provenance}#${routePath}`,
            track: "ui",
            screen_id: screenId,
            entity_id: entityIdForRoute(routePath),
            capability_hint: capabilityHints.primary_action,
            prominence: screenKind === "list" ? "primary" : "secondary"
          })
        );
      }
    }
  }

  for (const rootDir of svelteRoots) {
    const routes = inferSvelteRoutes(rootDir);
    if (routes.length === 0) {
      continue;
    }
    const provenance = relativeTo(paths.repoRoot, path.join(rootDir, "src", "routes"));
    findings.push({
      kind: "sveltekit_screen_routes",
      file: provenance,
      routes
    });
    candidates.stacks.push("sveltekit_web");
    for (const routePath of routes) {
      const screenId = screenIdForRoute(routePath);
      const screenKind = screenKindForRoute(routePath);
      const capabilityHints = uiCapabilityHintsForRoute(routePath);
      candidates.screens.push(
        makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          entity_id: entityIdForRoute(routePath),
          screen_kind: screenKind,
          route_path: routePath,
          capability_hints: capabilityHints
        })
      );
      candidates.routes.push(
        makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: routePath,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: `${provenance}#${routePath}`,
          track: "ui",
          screen_id: screenId,
          entity_id: entityIdForRoute(routePath),
          path: routePath
        })
      );
    }
  }

  for (const rootDir of nextRoots) {
    const routes = inferNextAppRoutes(rootDir);
    if (routes.length === 0) {
      continue;
    }
    const provenanceRoot = relativeTo(paths.repoRoot, path.join(rootDir, "app"));
    findings.push({
      kind: "next_app_routes",
      file: provenanceRoot,
      routes: routes.map((route) => route.path)
    });
    candidates.stacks.push("next_app_router");
    for (const route of routes) {
      if (route.kind !== "page") {
        continue;
      }
      const routeProvenance = `${relativeTo(paths.repoRoot, route.file)}#${route.path}`;
      const screenId = nextScreenIdForRoute(route.path);
      const screenKind = nextScreenKindForRoute(route.path);
      const capabilityHints = uiCapabilityHintsForNextRoute(route.path);
      const entityId = entityIdForNextRoute(route.path);
      const conceptId = conceptIdForNextRoute(route.path);
      candidates.screens.push(
        makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "medium",
          sourceKind: "route_code",
          provenance: routeProvenance,
          track: "ui",
          entity_id: entityId,
          concept_id: conceptId,
          screen_kind: screenKind,
          route_path: route.path,
          capability_hints: capabilityHints
        })
      );
      candidates.routes.push(
        makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: route.path,
          confidence: "medium",
          sourceKind: "route_code",
          provenance: routeProvenance,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: conceptId,
          path: route.path
        })
      );
      if (capabilityHints.primary_action) {
        candidates.actions.push(
          makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHints.primary_action)}`,
            label: capabilityHints.primary_action,
            confidence: "low",
            sourceKind: "route_code",
            provenance: routeProvenance,
            track: "ui",
            screen_id: screenId,
            entity_id: entityId,
            concept_id: conceptId,
            capability_hint: capabilityHints.primary_action,
            prominence: screenKind === "list" ? "primary" : "secondary"
          })
        );
      }
    }
  }

  candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
  candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
  candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
  candidates.stacks = [...new Set(candidates.stacks)].sort();

  return { findings, candidates };
}
