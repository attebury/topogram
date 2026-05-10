import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../../path-helpers.js";
import { canonicalCandidateTerm } from "./candidates.js";
import { listFilesRecursive, readTextIfExists } from "./files.js";

/**
 * @param {any} routePath
 * @returns {any}
 */
export function routeSegments(routePath) {
  return String(routePath || "")
    .split("/")
    .filter(Boolean)
    .map(/** @param {any} segment */ (segment) => segment.replace(/^:/, ""));
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function screenKindForRoute(routePath) {
  const normalized = String(routePath || "");
  const segments = routeSegments(normalized);
  if (/\/new$/.test(normalized)) return "form";
  if (/\/:?[A-Za-z0-9_]+\/edit$/.test(normalized)) return "form";
  if (segments.length >= 2 && !/\/new$/.test(normalized) && !/\/edit$/.test(normalized)) return "detail";
  return "list";
}

/**
 * @param {any} routePath
 * @returns {any}
 */
export function screenIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  const resource = canonicalCandidateTerm(segments[0] || "home");
  const kind = screenKindForRoute(routePath);
  if (kind === "form" && /\/new$/.test(routePath)) return `${resource}_create`;
  if (kind === "form" && /\/edit$/.test(routePath)) return `${resource}_edit`;
  if (kind === "detail") return `${resource}_detail`;
  return `${resource}_list`;
}

/**
 * @param {any} routePath
 * @returns {any}
 */
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

/**
 * @param {any} routePath
 * @returns {any}
 */
export function entityIdForRoute(routePath) {
  const segments = routeSegments(routePath);
  return `entity_${canonicalCandidateTerm(segments[0] || "item")}`;
}

/**
 * @param {any} rootDir
 * @returns {any}
 */
export function inferReactRoutes(rootDir) {
  const appPath = path.join(rootDir, "src", "App.tsx");
  const text = readTextIfExists(appPath);
  if (!text) return [];
  const routes = new Set();
  for (const match of text.matchAll(/path:\s*"([^"]+)"/g)) routes.add(match[1]);
  for (const match of text.matchAll(/path="([^"]+)"/g)) routes.add(match[1]);
  return [...routes].sort();
}

/**
 * @param {any} rootDir
 * @returns {any}
 */
export function inferSvelteRoutes(rootDir) {
  const routesRoot = path.join(rootDir, "src", "routes");
  if (!fs.existsSync(routesRoot)) return [];
  const files = listFilesRecursive(routesRoot, /** @param {any} child */ (child) => child.endsWith("+page.svelte") || child.endsWith("+page.ts") || child.endsWith("+page.server.ts"));
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

/**
 * @param {any} rootDir
 * @param {any} options
 * @returns {any}
 */
export function inferNavigationStructure(rootDir, options = {}) {
  const filePatterns = options.filePatterns || [/(^|\/)App\.(tsx|jsx)$/i, /(^|\/)\+layout\.svelte$/i];
  const files = listFilesRecursive(rootDir, /** @param {any} filePath */ (filePath) => filePatterns.some(/** @param {any} pattern */ (pattern) => pattern.test(filePath)));
  const result = /** @type {any} */ ({
    hasHeader: false,
    hasSidebar: false,
    hasTopbar: false,
    hasBottomTabs: false,
    hasTabs: false,
    hasBreadcrumbs: false,
    hasCommandPalette: false,
    hasSegmentedControl: false,
    navLinks: []
  });

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

/**
 * @param {any} navigation
 * @returns {any}
 */
export function shellKindFromNavigation(navigation) {
  if (!navigation) return null;
  if (navigation.hasBottomTabs) return "bottom_tabs";
  if (navigation.hasSidebar && navigation.hasHeader) return "split_view";
  if (navigation.hasSidebar) return "sidebar";
  if (navigation.hasTopbar || navigation.hasHeader) return "topbar";
  return null;
}

/**
 * @param {any} navigation
 * @returns {any}
 */
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

/**
 * @param {any} rootDir
 * @returns {any}
 */
export function detectUiPresentationFeatures(rootDir) {
  const files = listFilesRecursive(rootDir, /** @param {any} filePath */ (filePath) => /\.(tsx|ts|jsx|js|svelte|vue|html)$/i.test(filePath));
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
