import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../path-helpers.js";
import {
  canonicalCandidateTerm,
  ensureTrailingNewline,
  idHintify,
  pluralizeCandidateTerm,
  slugify,
  titleCase
} from "../../text-helpers.js";

export {
  canonicalCandidateTerm,
  ensureTrailingNewline,
  idHintify,
  pluralizeCandidateTerm,
  relativeTo,
  slugify,
  titleCase
};

export const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".yarn",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "tmp"
]);

export function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function listFilesRecursive(rootDir, predicate = () => true, options = {}) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;
  const files = [];
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const childPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        walk(childPath);
        continue;
      }
      if (entry.isFile() && predicate(childPath)) {
        files.push(childPath);
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

export function importSearchRoots(paths) {
  return [...new Set([paths.workspaceRoot, paths.topogramRoot].filter(Boolean))];
}

export function normalizeImportRelativePath(paths, filePath) {
  return relativeTo(paths.repoRoot, filePath);
}

export function canonicalSourceRank(paths, filePath, kind) {
  const relativePath = normalizeImportRelativePath(paths, filePath);
  const normalizedPath = relativePath.replaceAll(path.sep, "/");
  const penalties = [
    { pattern: /\/apps\/local-stack\//, weight: 80 },
    { pattern: /\/artifacts\/environment\//, weight: 60 },
    { pattern: /\/artifacts\/deploy\//, weight: 60 },
    { pattern: /\/artifacts\/compile-check\//, weight: 50 },
    { pattern: /\/artifacts\/db-lifecycle\//, weight: 50 },
    { pattern: /\/artifacts\/migrations\//, weight: 40 }
  ];

  let rank = 100;
  if (kind === "prisma") {
    if (/\/prisma\/schema\.prisma$/i.test(normalizedPath) && !normalizedPath.includes("/artifacts/")) {
      rank = 0;
    } else if (/\/apps\/backend\/prisma\/schema\.prisma$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/artifacts\/prisma\/schema\.prisma$/i.test(normalizedPath)) {
      rank = 10;
    }
  } else if (kind === "sql") {
    if (/\/db\/schema\.sql$/i.test(normalizedPath) || /\/schema\.sql$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/artifacts\/db\/.+\.sql$/i.test(normalizedPath)) {
      rank = 10;
    } else if (/migration/i.test(path.basename(normalizedPath))) {
      rank = 30;
    }
  } else if (kind === "openapi") {
    if (/\/artifacts\/openapi\/openapi\.(json|ya?ml)$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/openapi\.(json|ya?ml)$/i.test(normalizedPath) || /\/swagger\.(json|ya?ml)$/i.test(normalizedPath)) {
      rank = 10;
    }
  }

  for (const penalty of penalties) {
    if (penalty.pattern.test(normalizedPath)) {
      rank += penalty.weight;
    }
  }
  return rank;
}

export function selectPreferredImportFiles(paths, files, kind) {
  if (files.length === 0) {
    return [];
  }
  const rankedFiles = files.map((filePath) => ({
    filePath,
    rank: canonicalSourceRank(paths, filePath, kind)
  }));
  const bestRank = Math.min(...rankedFiles.map((entry) => entry.rank));
  return rankedFiles
    .filter((entry) => entry.rank === bestRank)
    .map((entry) => entry.filePath)
    .sort();
}

export function findImportFiles(paths, predicate) {
  const files = new Set();
  for (const rootDir of importSearchRoots(paths)) {
    for (const filePath of listFilesRecursive(rootDir, predicate)) {
      if (
        filePath.includes(`${path.sep}candidates${path.sep}`) ||
        filePath.includes(`${path.sep}docs-generated${path.sep}`) ||
        filePath.includes(`${path.sep}topogram${path.sep}tests${path.sep}fixtures${path.sep}expected${path.sep}`)
      ) {
        continue;
      }
      files.add(filePath);
    }
  }
  return [...files].sort();
}

export function makeCandidateRecord({
  kind,
  idHint,
  label,
  confidence = "medium",
  sourceKind,
  sourceOfTruth = "imported",
  provenance,
  track = null,
  ...payload
}) {
  const inferredTrack =
    track ||
    (["entity", "enum", "relation", "index"].includes(kind)
      ? "db"
      : kind === "capability"
        ? "api"
        : kind === "widget"
          ? "ui"
          : null);
  return {
    kind,
    id_hint: idHint,
    label,
    confidence,
    source_kind: sourceKind,
    source_of_truth: sourceOfTruth,
    provenance: Array.isArray(provenance) ? provenance : [provenance].filter(Boolean),
    track: inferredTrack,
    ...payload
  };
}

export function dedupeCandidateRecords(records, keyFn) {
  const seen = new Map();
  for (const record of records) {
    const key = keyFn(record);
    const recordProvenance = Array.isArray(record.provenance) ? record.provenance : [record.provenance].filter(Boolean);
    if (!seen.has(key)) {
      seen.set(key, { ...record, provenance: recordProvenance });
      continue;
    }
    const current = seen.get(key);
    const currentProvenance = Array.isArray(current.provenance) ? current.provenance : [current.provenance].filter(Boolean);
    current.provenance = [...new Set([...currentProvenance, ...recordProvenance])];
  }
  return [...seen.values()];
}

export function normalizePrismaType(typeName) {
  const normalized = String(typeName || "").toLowerCase();
  switch (normalized) {
    case "string": return "string";
    case "int": return "int";
    case "bigint": return "bigint";
    case "float": return "float";
    case "decimal": return "decimal";
    case "boolean":
    case "bool": return "boolean";
    case "datetime": return "datetime";
    case "bytes": return "bytes";
    case "json": return "json";
    default: return typeName;
  }
}

export function normalizeOpenApiPath(pathValue) {
  return String(pathValue || "")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}")
    .replace(/\/+$/, "") || "/";
}

export function normalizeEndpointPathForMatch(pathValue) {
  const normalizedPath = normalizeOpenApiPath(pathValue);
  const segments = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (/^\{[^}]+\}$/.test(segment)) {
        return "{}";
      }
      return segment
        .split("-")
        .map((part) => canonicalCandidateTerm(part))
        .join("-");
    });
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

export function nonParamEndpointSegments(pathValue) {
  return normalizeOpenApiPath(pathValue)
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "{}" && !/^\{[^}]+\}$/.test(segment))
    .map((segment) => canonicalCandidateTerm(segment));
}

function trimmedApiSegments(pathValue) {
  const segments = nonParamEndpointSegments(pathValue);
  if (segments[0] === "api" && segments.length > 1) {
    return segments.slice(1);
  }
  if (segments[0] === "admin" && segments.length > 1) {
    return segments.slice(1);
  }
  return segments;
}

export function inferApiEntityIdFromPath(pathValue, options = {}) {
  const tags = (options.tags || []).map((tag) => canonicalCandidateTerm(tag));
  const summary = String(options.summary || "").toLowerCase();
  const normalizedPath = normalizeOpenApiPath(pathValue);
  const segments = trimmedApiSegments(normalizedPath);

  if (/\/(login|signin|sign-in|signup|register)$/.test(normalizedPath) || tags.includes("authentication")) {
    return "entity_account";
  }
  if (normalizedPath === "/me" || segments.includes("profile") || /profile/.test(summary)) {
    return "entity_profile";
  }
  if (tags.includes("member") || tags.includes("members") || segments.includes("membership") || segments.includes("memberships") || segments.includes("member") || segments.includes("members")) {
    return "entity_workspace-membership";
  }
  if (segments.includes("audit-log") || segments.includes("audit-logs")) {
    return "entity_audit-log";
  }
  if (segments.includes("account") || segments.includes("accounts")) {
    return "entity_account";
  }
  if (segments.includes("workspace") || segments.includes("workspaces")) {
    return "entity_workspace";
  }
  const nestedResourceActions = new Set(["favorite", "follow", "feed", "stats", "role", "status", "login", "signin", "sign-in", "signup", "register", "search", "payment", "delivery"]);
  const lastSegment = segments[segments.length - 1];
  const resource = segments.length > 1 && lastSegment && !nestedResourceActions.has(lastSegment)
    ? lastSegment
    : (segments[0] || "item");
  return `entity_${canonicalCandidateTerm(resource)}`;
}

export function inferApiCapabilityIdFromOperation(operation) {
  const method = String(operation.method || "").toUpperCase();
  const pathValue = normalizeOpenApiPath(operation.path || "");
  const summary = String(operation.summary || "").toLowerCase();
  const tags = operation.tags || [];
  const segments = trimmedApiSegments(pathValue);
  const rawSegments = normalizeOpenApiPath(pathValue)
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^\{[^}]+\}$/.test(segment));
  const trimmedRawSegments = rawSegments[0] === "api" && rawSegments.length > 1
    ? rawSegments.slice(1)
    : rawSegments[0] === "admin" && rawSegments.length > 1
      ? rawSegments.slice(1)
      : rawSegments;
  const hasPathParams = /\{[^}]+\}/.test(pathValue);
  const entityStem = inferApiEntityIdFromPath(pathValue, { tags, summary }).replace(/^entity_/, "").replace(/-/g, "_");
  const last = segments[segments.length - 1] || entityStem;
  const rawLast = trimmedRawSegments[trimmedRawSegments.length - 1] || "";

  if (/(^|\/)(login|signin|sign-in)$/.test(pathValue) || /(sign in|login)/.test(summary)) {
    return `cap_sign_in_${entityStem}`;
  }
  if (/(^|\/)(signup|register)$/.test(pathValue) || /(sign up|signup|registration|register)/.test(summary)) {
    return `cap_register_${entityStem}`;
  }
  if (/(^|\/)search\/\{[^}]+\}$/.test(pathValue) || /(search)/.test(summary)) {
    return `cap_search_${pluralizeCandidateTerm(entityStem)}`;
  }
  if (pathValue === "/me") {
    return `cap_get_${entityStem}`;
  }
  if (method === "GET" && /\/feed$/.test(pathValue)) {
    return `cap_feed_${entityStem}`;
  }
  if (method === "POST" && /\/favorite$/.test(pathValue)) {
    return `cap_favorite_${entityStem}`;
  }
  if (method === "DELETE" && /\/favorite$/.test(pathValue)) {
    return `cap_unfavorite_${entityStem}`;
  }
  if (method === "POST" && /\/follow$/.test(pathValue)) {
    return `cap_follow_${entityStem}`;
  }
  if (method === "DELETE" && /\/follow$/.test(pathValue)) {
    return `cap_unfollow_${entityStem}`;
  }
  if (method === "POST" && /\/payment$/.test(pathValue)) {
    return `cap_pay_${entityStem}`;
  }
  if (method === "POST" && /\/delivery$/.test(pathValue)) {
    return `cap_delivery_${entityStem}`;
  }

  if ((method === "PATCH" || method === "PUT") && ["role", "status"].includes(last)) {
    return `cap_update_${entityStem}_${last}`;
  }
  if (method === "GET" && last === "stats") {
    return `cap_get_${entityStem}_stats`;
  }

  if (method === "GET" && segments.length <= 1 && !hasPathParams) {
    const singularPath = rawLast && canonicalCandidateTerm(rawLast) === rawLast;
    return singularPath ? `cap_get_${entityStem}` : `cap_list_${pluralizeCandidateTerm(entityStem)}`;
  }
  if (method === "GET" && segments.length <= 1 && hasPathParams) return `cap_get_${entityStem}`;
  if (method === "GET" && segments.length > 1 && !["role", "status", "stats"].includes(last)) {
    if (!/\{[^}]+\}$/.test(pathValue) && rawLast && canonicalCandidateTerm(rawLast) !== rawLast) {
      return `cap_list_${pluralizeCandidateTerm(entityStem)}`;
    }
    if (segments.includes("member") || segments.includes("membership") || segments.includes("memberships")) {
      return `cap_list_${pluralizeCandidateTerm(entityStem)}`;
    }
    return `cap_get_${entityStem}`;
  }
  if (method === "POST") return `cap_create_${entityStem}`;
  if (method === "PATCH" || method === "PUT") return `cap_update_${entityStem}`;
  if (method === "DELETE") return `cap_delete_${entityStem}`;
  return `candidate_${String(operation.method || "unknown").toLowerCase()}_${slugify(pathValue)}`;
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
  if (/\/new$/.test(normalized)) return "form";
  if (/\/:?[A-Za-z0-9_]+\/edit$/.test(normalized)) return "form";
  if (segments.length >= 2 && !/\/new$/.test(normalized) && !/\/edit$/.test(normalized)) return "detail";
  return "list";
}

export function screenIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  const resource = canonicalCandidateTerm(segments[0] || "home");
  const kind = screenKindForRoute(routePath);
  if (kind === "form" && /\/new$/.test(routePath)) return `${resource}_create`;
  if (kind === "form" && /\/edit$/.test(routePath)) return `${resource}_edit`;
  if (kind === "detail") return `${resource}_detail`;
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

export function inferReactRoutes(rootDir) {
  const appPath = path.join(rootDir, "src", "App.tsx");
  const text = readTextIfExists(appPath);
  if (!text) return [];
  const routes = new Set();
  for (const match of text.matchAll(/path:\s*"([^"]+)"/g)) routes.add(match[1]);
  for (const match of text.matchAll(/path="([^"]+)"/g)) routes.add(match[1]);
  return [...routes].sort();
}

export function inferSvelteRoutes(rootDir) {
  const routesRoot = path.join(rootDir, "src", "routes");
  if (!fs.existsSync(routesRoot)) return [];
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

export function inferNavigationStructure(rootDir, options = {}) {
  const filePatterns = options.filePatterns || [/(^|\/)App\.(tsx|jsx)$/i, /(^|\/)\+layout\.svelte$/i];
  const files = listFilesRecursive(rootDir, (filePath) => filePatterns.some((pattern) => pattern.test(filePath)));
  const result = {
    hasHeader: false,
    hasSidebar: false,
    hasTopbar: false,
    hasBottomTabs: false,
    hasTabs: false,
    hasBreadcrumbs: false,
    hasCommandPalette: false,
    hasSegmentedControl: false,
    navLinks: []
  };

  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    if (!text) continue;
    if (/<header\b|class(Name)?=["'][^"']*(topbar|app-nav|navbar)/i.test(text)) {
      result.hasHeader = true;
      result.hasTopbar = true;
    }
    if (/<aside\b|class(Name)?=["'][^"']*(sidebar|side-nav|sidenav)/i.test(text)) {
      result.hasSidebar = true;
    }
    if (/\bbottom[-_ ]tabs\b|\bTabBar\b|\bBottomNavigation\b/i.test(text)) {
      result.hasBottomTabs = true;
    }
    if (/breadcrumb/i.test(text)) {
      result.hasBreadcrumbs = true;
    }
    if (/\bcommand palette\b|\bCommandPalette\b/i.test(text)) {
      result.hasCommandPalette = true;
    }
    if (/\bsegmented\b|\bSegmentedControl\b/i.test(text)) {
      result.hasSegmentedControl = true;
    }
    if (/<nav\b|role=["']tablist["']|class(Name)?=["'][^"']*\btabs?\b/i.test(text)) {
      result.hasTabs = result.hasTabs || /role=["']tablist["']|class(Name)?=["'][^"']*\btabs?\b/i.test(text);
      for (const match of text.matchAll(/(?:href|to)=["'`]([^"'`]+)["'`]/g)) {
        result.navLinks.push(match[1]);
      }
    }
  }

  result.navLinks = [...new Set(result.navLinks)].sort();
  return result;
}

export function shellKindFromNavigation(navigation) {
  if (!navigation) return null;
  if (navigation.hasBottomTabs) return "bottom_tabs";
  if (navigation.hasSidebar && navigation.hasHeader) return "split_view";
  if (navigation.hasSidebar) return "sidebar";
  if (navigation.hasTopbar || navigation.hasHeader) return "topbar";
  return null;
}

export function navigationPatternsFromStructure(navigation) {
  const patterns = new Set();
  if (!navigation) return [];
  if (navigation.hasTabs) patterns.add("tabs");
  if (navigation.hasBreadcrumbs) patterns.add("breadcrumbs");
  if (navigation.hasBottomTabs) patterns.add("bottom_tabs");
  if (navigation.hasRail) patterns.add("navigation_rail");
  if (navigation.hasCommandPalette) patterns.add("command_palette");
  if (navigation.hasSegmentedControl) patterns.add("segmented_control");
  if (navigation.hasSidebar && navigation.hasHeader) patterns.add("split_view");
  return [...patterns].sort();
}

export function detectUiPresentationFeatures(rootDir) {
  const files = listFilesRecursive(rootDir, (filePath) => /\.(tsx|ts|jsx|js|svelte|vue|html)$/i.test(filePath));
  const features = new Set();

  for (const filePath of files) {
    const text = readTextIfExists(filePath) || "";
    if (!text) continue;
    if (/\bDataGrid\b|\bag-grid\b|\bAGGrid\b|\bTanStackTable\b|\breact-data-grid\b|\bmui[-_ ]?datagrid\b/i.test(text)) {
      features.add("data_grid");
    }
    if (/<table\b|react-table/i.test(text)) features.add("table");
    if (/\b(card|cards|Card)\b/.test(text)) features.add("cards");
    if (/\bkanban|board\b/i.test(text)) features.add("board");
    if (/\bcalendar\b/i.test(text)) features.add("calendar");
    if (/\bgallery\b/i.test(text)) features.add("gallery");
    if (/\bmodal\b|Dialog|AlertDialog/i.test(text)) features.add("modal");
    if (/\bdrawer\b|Sheet/i.test(text)) features.add("drawer");
    if (/\bsheet\b|BottomSheet|ModalBottomSheet/i.test(text)) features.add("sheet");
    if (/\bBottomSheet\b|\bModalBottomSheet\b/i.test(text)) features.add("bottom_sheet");
    if (/\bFloatingActionButton\b|\bExtendedFloatingActionButton\b|\bfloating action button\b/i.test(text)) features.add("fab");
    if (/\bempty state\b|empty-state|No results|No items/i.test(text)) features.add("empty_state");
    if (/\berror state\b|Something went wrong|error/i.test(text)) features.add("error_state");
    if (/\bloading\b|skeleton|spinner/i.test(text)) features.add("loading_state");
    if (/\bbreadcrumb/i.test(text)) features.add("breadcrumbs");
    if (/\bactivity\b|\btimeline\b|\bcomment/i.test(text)) features.add("activity");
    if (/\bsettings\b|\bpreferences\b|\bbilling\b|\bsecurity\b/i.test(text)) features.add("settings");
    if (/\bonboarding\b|\bwizard\b|\bstepper\b/i.test(text)) features.add("wizard");
    if (/\bpull[-_ ]to[-_ ]refresh\b|SwipeRefresh|refreshable\b/i.test(text)) features.add("pull_to_refresh");
    if (/\bcommand palette\b|\bCommandPalette\b/i.test(text)) features.add("command_palette");
    if (/\binspector\b|\bDetailsPane\b|\bproperties pane\b/i.test(text)) features.add("inspector_pane");
    if (/\bWindowGroup\b|\bBrowserWindow\b|\bmulti[-_ ]window\b/i.test(text)) features.add("multi_window");
  }

  return [...features].sort();
}

export function inferNextAppRoutes(rootDir) {
  const appDir = path.join(rootDir, "app");
  if (!fs.existsSync(appDir)) return [];
  const routeFiles = listFilesRecursive(
    appDir,
    (child) => /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) || /\/route\.(tsx|ts|jsx|js)$/.test(child)
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const relative = relativeTo(appDir, filePath);
    const isPage = /\/page\.(tsx|ts|jsx|js|mdx)$/.test(`/${relative}`) || /^page\.(tsx|ts|jsx|js|mdx)$/.test(relative);
    const normalizedPath = `/${relative}`
      .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_m, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
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
  if (/\/(login|register|setup)$/.test(normalized)) return "flow";
  return screenKindForRoute(routePath);
}

export function nextScreenIdForRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") return "home";
  if (/\/login$/.test(normalized)) return "login";
  if (/\/register$/.test(normalized)) return "register";
  if (/\/setup$/.test(normalized)) return "setup";
  return screenIdForRoute(routePath);
}

export function entityIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (/^\/posts(\/|$)/.test(normalized)) return "entity_post";
  if (/^\/users(\/|$)/.test(normalized)) return "entity_user";
  return null;
}

export function conceptIdForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") return "surface_home";
  if (/\/login$/.test(normalized)) return "flow_login";
  if (/\/register$/.test(normalized)) return "flow_register";
  if (/\/setup$/.test(normalized)) return "flow_setup";
  return entityIdForNextRoute(routePath) || entityIdForRoute(routePath);
}

export function uiCapabilityHintsForNextRoute(routePath) {
  const normalized = String(routePath || "");
  if (normalized === "/") return { load: null, submit: null, primary_action: null };
  if (/\/login$/.test(normalized)) return { load: null, submit: "cap_sign_in_user", primary_action: "cap_sign_in_user" };
  if (/\/register$/.test(normalized)) return { load: null, submit: "cap_register_user", primary_action: "cap_register_user" };
  if (/\/setup$/.test(normalized)) return { load: null, submit: null, primary_action: null };
  if (/^\/posts\/new$/.test(normalized)) return { load: null, submit: "cap_create_post", primary_action: "cap_create_post" };
  if (/^\/posts\/:id$/.test(normalized) || /^\/posts\/:[^/]+$/.test(normalized)) return { load: "cap_get_post", submit: null, primary_action: "cap_update_post" };
  if (/^\/posts$/.test(normalized)) return { load: "cap_list_posts", submit: null, primary_action: "cap_create_post" };
  if (/^\/users\/new$/.test(normalized)) return { load: null, submit: "cap_create_user", primary_action: "cap_create_user" };
  return uiCapabilityHintsForRoute(routePath);
}

export function inferRouteQueryParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/\bquery\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) params.add(match[1]);
  for (const match of String(text || "").matchAll(/\bquery\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) params.add(match[1]);
  return [...params].sort();
}

export function inferRouteAuthHint(routeArguments, handlerContext) {
  const combined = `${routeArguments || ""}\n${handlerContext || ""}`.toLowerCase();
  if (/\b(signin|sign_in|login|register|credentialsprovider)\b/.test(combined)) {
    return "public";
  }
  return /\b(auth|session|permission|guard|protected|require_auth|requireauth|ensureauth)\b/.test(combined)
    ? "secured"
    : "unknown";
}

export function extractNamedExportBlock(text, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`export\\s+async\\s+function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,2000}?)\\n\\}`, "m"));
  return match ? match[1] : "";
}

export function inferNextRequestSearchParams(text) {
  const params = new Set();
  for (const match of String(text || "").matchAll(/searchParams\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    params.add(match[1]);
  }
  return [...params].sort();
}

export function inferNextJsonFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/NextResponse\.json\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
    for (const fieldMatch of match[1].matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*[:,]/g)) {
      fields.add(fieldMatch[1]);
    }
  }
  return [...fields].sort();
}

export function extractHandlerContext(text, handlerName) {
  if (!handlerName) return "";
  const escapedName = handlerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m"),
    new RegExp(`const\\s+${escapedName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]{0,1200}?)\\n\\}`, "m")
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "";
}

export function inferRouteCapabilityId(route) {
  if (route.handler_hint) {
    const genericHttpHandler = /^(get|post|put|patch|delete)$/i.test(route.handler_hint);
    if (!genericHttpHandler) {
      const normalizedHandler = route.handler_hint
        .replace(/^(handle|on)/i, "")
        .replace(/(handler|route|controller|action)$/i, "");
      const handlerTokens = normalizedHandler
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((token) => token.toLowerCase());
      if (handlerTokens.length > 0) {
        return `cap_${handlerTokens.join("_")}`;
      }
    }
  }
  return inferApiCapabilityIdFromOperation(route);
}

export function nextAppRoutePathFromFile(appRoot, filePath) {
  const relative = relativeTo(appRoot, filePath);
  return `/${relative}`
    .replace(/\/actions\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`)
    .replace(/\/index$/, "")
    .replace(/^\/$/, "/") || "/";
}

export function inferFormDataFields(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/formData\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

export function inferInputNames(text) {
  const fields = new Set();
  for (const match of String(text || "").matchAll(/\bname=["'`]([^"'`]+)["'`]/g)) {
    fields.add(match[1]);
  }
  return [...fields].sort();
}

export function inferNextApiRoutes(workspaceRoot, helpers = { readTextIfExists }) {
  const apiRoot = path.join(workspaceRoot, "app", "api");
  if (!fs.existsSync(apiRoot)) return [];
  const routeFiles = listFilesRecursive(
    apiRoot,
    (child) => /\/route\.(tsx|ts|jsx|js)$/.test(child) || /^route\.(tsx|ts|jsx|js)$/.test(path.basename(child))
  );
  const routes = [];
  for (const filePath of routeFiles) {
    const text = helpers.readTextIfExists(filePath) || "";
    const relative = relativeTo(apiRoot, filePath);
    const routePath = `/${relative}`
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/\[(\.\.\.)?([^\]]+)\]/g, (_match, catchAll, name) => catchAll ? `:${name}*` : `:${name}`);
    for (const match of text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(([^)]*)\)/g)) {
      const method = match[1].toUpperCase();
      const handlerContext = extractNamedExportBlock(text, match[1]) || "";
      routes.push({
        file: filePath,
        method,
        path: routePath === "" ? "/" : routePath,
        handler_hint: match[1].toLowerCase(),
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        query_params: inferNextRequestSearchParams(handlerContext),
        output_fields: inferNextJsonFields(handlerContext),
        auth_hint: inferRouteAuthHint(match[0], handlerContext),
        source_kind: "route_code"
      });
    }
  }
  return routes;
}

export function inferCapabilityEntityId(record) {
  if (record.entity_id) {
    return record.entity_id;
  }
  const pathSegments = normalizeEndpointPathForMatch(record.endpoint?.path || "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "{}");
  const resourceSegment = pathSegments[0] || String(record.id_hint || "").replace(/^cap_(create|update|delete|get|list)_/, "");
  return `entity_${idHintify(canonicalCandidateTerm(resourceSegment))}`;
}

export function inferNextServerActionCapabilities(workspaceRoot, helpers = { readTextIfExists }) {
  const appRoot = path.join(workspaceRoot, "app");
  if (!fs.existsSync(appRoot)) return [];
  const actionFiles = listFilesRecursive(
    appRoot,
    (child) =>
      /\/actions\.(tsx|ts|jsx|js)$/.test(child) ||
      /\/page\.(tsx|ts|jsx|js|mdx)$/.test(child) ||
      /^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(child))
  );
  const capabilities = [];
  for (const filePath of actionFiles) {
    const text = helpers.readTextIfExists(filePath) || "";
    const routePath = nextAppRoutePathFromFile(appRoot, filePath);
    for (const match of text.matchAll(/(?:export\s+)?async\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]{0,2400}?)\n\}/g)) {
      const functionName = match[1];
      const body = match[3] || "";
      const trimmedBody = body.trimStart();
      const isServerAction =
        /\/actions\.(tsx|ts|jsx|js)$/.test(filePath) ||
        trimmedBody.startsWith('"use server"') ||
        trimmedBody.startsWith("'use server'");
      if (!isServerAction) continue;
      const routeLike = {
        file: filePath,
        method: "POST",
        path: routePath,
        handler_hint: functionName,
        auth_hint: inferRouteAuthHint(functionName, body)
      };
      const idHint = inferRouteCapabilityId(routeLike);
      capabilities.push({
        file: filePath,
        function_name: functionName,
        method: "POST",
        path: routePath,
        id_hint: idHint,
        input_fields: inferFormDataFields(body),
        output_fields: [],
        path_params: [...normalizeOpenApiPath(routePath).matchAll(/\{([^}]+)\}/g)].map((entry) => entry[1]),
        auth_hint: routeLike.auth_hint,
        entity_id: inferCapabilityEntityId({ endpoint: { path: routePath }, id_hint: idHint }),
        source_kind: "route_code"
      });
    }
  }
  return capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint) || a.path.localeCompare(b.path));
}

export function inferNextAuthCapabilities(paths, helpers = { readTextIfExists }) {
  const authConfigPath = path.join(paths.workspaceRoot, "auth.ts");
  const authConfigText = helpers.readTextIfExists(authConfigPath) || "";
  const hasCredentialsProvider = /CredentialsProvider\s*\(/.test(authConfigText);
  const createsUserOnAuthorize = /prisma\.user\.create\s*\(/.test(authConfigText);
  const pages = [
    {
      file: path.join(paths.workspaceRoot, "app", "login", "page.tsx"),
      path: "/login",
      id_hint: "cap_sign_in_user",
      label: "Sign In User",
      target_state: "authenticated"
    },
    {
      file: path.join(paths.workspaceRoot, "app", "register", "page.tsx"),
      path: "/register",
      id_hint: "cap_register_user",
      label: "Register User",
      target_state: createsUserOnAuthorize ? "registered" : "created"
    }
  ];
  const capabilities = [];
  for (const page of pages) {
    const text = helpers.readTextIfExists(page.file) || "";
    if (!text || !/signIn\(\s*["'`]credentials["'`]/.test(text)) continue;
    capabilities.push({
      file: page.file,
      function_name: page.id_hint.replace(/^cap_/, ""),
      method: "POST",
      path: page.path,
      id_hint: page.id_hint,
      label: page.label,
      input_fields: inferInputNames(text),
      output_fields: [],
      path_params: [],
      auth_hint: "public",
      entity_id: "entity_user",
      target_state: page.target_state,
      provenance: [
        relativeTo(paths.repoRoot, page.file),
        ...(hasCredentialsProvider ? [relativeTo(paths.repoRoot, authConfigPath)] : [])
      ],
      source_kind: "route_code"
    });
  }
  return capabilities.sort((a, b) => a.id_hint.localeCompare(b.id_hint));
}
