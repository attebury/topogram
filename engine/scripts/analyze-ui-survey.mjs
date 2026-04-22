#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const defaultSurveyRoot = path.join(repoRoot, "trials", "ui-survey");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function countBy(values) {
  const counts = {};
  for (const value of values.filter(Boolean)) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function countNested(valuesByRepo) {
  return countBy(valuesByRepo.flatMap((entry) => entry || []));
}

function repoText(filePath) {
  return readText(path.join(repoRoot, filePath));
}

function repoTextAny(paths) {
  return paths.map((filePath) => repoText(filePath)).join("\n");
}

function listFiles(rootDir, predicate) {
  if (!fs.existsSync(rootDir)) return [];
  const ignored = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo", ".yarn", "Pods", "DerivedData", "vendor", "target"]);
  const files = [];
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignored.has(entry.name)) continue;
        walk(absolutePath);
      } else if (entry.isFile() && predicate(absolutePath)) {
        files.push(absolutePath);
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function validateManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.repos)) {
    throw new Error("Survey manifest must contain a 'repos' array");
  }
  const seen = new Set();
  for (const repo of manifest.repos) {
    for (const key of ["id", "category", "platform_family", "ui_runtime", "clone_strategy", "survey_priority", "repo", "path"]) {
      if (!repo[key]) {
        throw new Error(`Survey manifest entry is missing required field '${key}'`);
      }
    }
    if (!["web", "android", "ios", "desktop"].includes(repo.platform_family)) {
      throw new Error(`Survey manifest entry '${repo.id}' has invalid platform_family '${repo.platform_family}'`);
    }
    if (!["shallow_filtered", "shallow", "full"].includes(repo.clone_strategy)) {
      throw new Error(`Survey manifest entry '${repo.id}' has invalid clone_strategy '${repo.clone_strategy}'`);
    }
    if (!["core", "extended"].includes(repo.survey_priority)) {
      throw new Error(`Survey manifest entry '${repo.id}' has invalid survey_priority '${repo.survey_priority}'`);
    }
    if (seen.has(repo.id)) {
      throw new Error(`Survey manifest has duplicate repo id '${repo.id}'`);
    }
    seen.add(repo.id);
  }
}

function detectWebRuntime(rootDir) {
  if (fs.existsSync(path.join(rootDir, "src", "routes"))) return "sveltekit";
  if (fs.existsSync(path.join(rootDir, "app")) && fs.existsSync(path.join(rootDir, "package.json"))) return "next_app_router";
  if (fs.existsSync(path.join(rootDir, "src", "App.tsx")) || fs.existsSync(path.join(rootDir, "src", "App.jsx"))) return "react_router_spa";
  if (fs.existsSync(path.join(rootDir, "package.json"))) return "web_app";
  if (fs.existsSync(path.join(rootDir, "composer.json"))) return "php_web_app";
  if (fs.existsSync(path.join(rootDir, "Gemfile"))) return "rails_or_ruby_web_app";
  return "unknown";
}

function detectAndroidRuntime(rootDir) {
  const ktFiles = listFiles(rootDir, (filePath) => /\.(kt|kts)$/i.test(filePath));
  const xmlFiles = listFiles(rootDir, (filePath) => /res\/layout\/.+\.xml$/i.test(filePath) || /res\/menu\/.+\.xml$/i.test(filePath));
  const composeDetected = ktFiles.some((filePath) => {
    const text = readText(filePath);
    return /@Composable\b|NavigationBar\b|ModalBottomSheet\b|Scaffold\s*\(/.test(text);
  });
  if (composeDetected) return "jetpack_compose";
  if (xmlFiles.length > 0) return "xml_views";
  return "android_app";
}

function detectIosRuntime(rootDir) {
  const swiftFiles = listFiles(rootDir, (filePath) => /\.swift$/i.test(filePath));
  const hasSwiftUi = swiftFiles.some((filePath) =>
    /\bimport\s+SwiftUI\b|\bNavigationStack\b|\bTabView\b|\bNavigationSplitView\b/.test(readText(filePath))
  );
  const hasUiKit = swiftFiles.some((filePath) => /\bUIViewController\b|\bUITableViewController\b|\bUICollectionViewController\b|\bUINavigationController\b|\bUITabBarController\b/.test(readText(filePath)));
  if (hasSwiftUi) return "swiftui";
  if (hasUiKit) return "uikit";
  return "ios_app";
}

function detectDesktopRuntime(rootDir) {
  const packageJson = readText(path.join(rootDir, "package.json"));
  if (fs.existsSync(path.join(rootDir, "src-tauri")) || /"@tauri-apps\/api"|"tauri"/.test(packageJson)) return "tauri";
  if (/"electron"|electron-builder|electron-forge/.test(packageJson)) return "electron";

  const swiftFiles = listFiles(rootDir, (filePath) => /\.swift$/i.test(filePath));
  if (swiftFiles.some((filePath) => /\bimport\s+AppKit\b|\bNSWindow\b|\bNSMenu\b/.test(readText(filePath)))) return "macos_native";

  const csprojFiles = listFiles(rootDir, (filePath) => /\.csproj$/i.test(filePath));
  if (csprojFiles.some((filePath) => /WinUI|WindowsAppSDK|UseWPF|UseWinUI/.test(readText(filePath)))) return "winui";

  const cargoToml = readText(path.join(rootDir, "Cargo.toml"));
  if (/\bgtk\b|\bgtk4\b/.test(cargoToml)) return "gtk";
  if (/\bfloem\b|\bdruid\b|\biced\b|\begui\b/.test(cargoToml)) return "desktop_native";

  const cmakeLists = readText(path.join(rootDir, "CMakeLists.txt"));
  if (/find_package\s*\(\s*Qt/i.test(cmakeLists) || /\bQt6?\b/.test(cmakeLists)) return "qt";

  return "desktop_app";
}

function detectRuntime(rootDir, platformFamily) {
  if (platformFamily === "android") return detectAndroidRuntime(rootDir);
  if (platformFamily === "ios") return detectIosRuntime(rootDir);
  if (platformFamily === "desktop") return detectDesktopRuntime(rootDir);
  return detectWebRuntime(rootDir);
}

function detectWebSignals(rootDir) {
  const files = listFiles(rootDir, (filePath) => /\.(tsx|jsx|ts|js|svelte|vue|php|erb|html)$/i.test(filePath));
  const signals = {
    shell: "unknown",
    navigationPatterns: new Set(),
    features: new Set()
  };

  for (const filePath of files) {
    const text = readText(filePath);
    if (/<header\b|class(Name)?=["'][^"']*(topbar|navbar|app-nav)/i.test(text)) signals.shell = signals.shell === "unknown" ? "topbar" : signals.shell;
    if (/<aside\b|class(Name)?=["'][^"']*(sidebar|sidenav|side-nav)/i.test(text)) signals.shell = "sidebar";
    if (/breadcrumb/i.test(text)) signals.navigationPatterns.add("breadcrumbs");
    if (/role=["']tablist["']|class(Name)?=["'][^"']*\btabs?\b/i.test(text)) signals.navigationPatterns.add("tabs");
    if (/\bDataGrid\b|\bag-grid\b|\bAGGrid\b|\bTanStackTable\b|\breact-data-grid\b|\bmui[-_ ]?datagrid\b/i.test(text)) signals.features.add("data_grid");
    if (/<table\b|react-table/i.test(text)) signals.features.add("table");
    if (/\bcard\b|\bcards\b|<Card\b/i.test(text)) signals.features.add("cards");
    if (/\bkanban\b|\bboard\b/i.test(text)) signals.features.add("board");
    if (/\bcalendar\b/i.test(text)) signals.features.add("calendar");
    if (/\bgallery\b/i.test(text)) signals.features.add("gallery");
    if (/\bmodal\b|Dialog|AlertDialog/i.test(text)) signals.features.add("modal");
    if (/\bdrawer\b|Sheet/i.test(text)) signals.features.add("drawer");
    if (/\bsettings\b|\bpreferences\b|\bbilling\b|\bsecurity\b/i.test(text)) signals.features.add("settings");
    if (/\bonboarding\b|\bwizard\b|\bstepper\b/i.test(text)) signals.features.add("wizard");
    if (/\bactivity\b|\btimeline\b|\bcomment/i.test(text)) signals.features.add("activity");
    if (/\bloading\b|skeleton|spinner/i.test(text)) signals.features.add("loading_state");
    if (/empty-state|No results|No items|empty state/i.test(text)) signals.features.add("empty_state");
    if (/Something went wrong|error state|\berror\b/i.test(text)) signals.features.add("error_state");
  }

  return signals;
}

function detectAndroidSignals(rootDir) {
  const files = listFiles(rootDir, (filePath) => /\.(kt|kts|xml)$/i.test(filePath));
  const signals = {
    shell: "unknown",
    navigationPatterns: new Set(),
    features: new Set()
  };

  for (const filePath of files) {
    const text = readText(filePath);
    if (hasAny(text, [/\bScaffold\s*\(/, /\bTopAppBar\b/, /\bCenterAlignedTopAppBar\b/, /\bLargeTopAppBar\b/, /\bMaterialToolbar\b/, /\bToolbar\b/])) {
      signals.shell = signals.shell === "unknown" ? "topbar" : signals.shell;
    }
    if (hasAny(text, [/\bNavigationBar\b/, /\bBottomNavigationView\b/])) {
      signals.shell = "bottom_tabs";
      signals.navigationPatterns.add("bottom_tabs");
    }
    if (hasAny(text, [/\bNavigationRail\b/])) {
      signals.navigationPatterns.add("navigation_rail");
      if (signals.shell === "unknown") signals.shell = "sidebar";
    }
    if (hasAny(text, [/\bNavHost\b/, /\bNavController\b/, /\bFragmentContainerView\b/, /\bNavHostFragment\b/])) {
      signals.navigationPatterns.add("stack_navigation");
    }
    if (hasAny(text, [/\bDrawerLayout\b/, /\bModalNavigationDrawer\b/, /\bDismissibleNavigationDrawer\b/])) {
      signals.shell = "sidebar";
      signals.features.add("drawer");
    }
    if (hasAny(text, [/\bModalBottomSheet\b/, /\bBottomSheetScaffold\b/, /\bBottomSheetDialog\b/])) {
      signals.features.add("bottom_sheet");
      signals.features.add("sheet");
    }
    if (hasAny(text, [/\bFloatingActionButton\b/, /\bExtendedFloatingActionButton\b/])) {
      signals.features.add("fab");
    }
    if (hasAny(text, [/\bTabRow\b/, /\bScrollableTabRow\b/, /\bTabLayout\b/, /\bViewPager2\b/, /\bHorizontalPager\b/])) {
      signals.navigationPatterns.add("tabs");
    }
    if (hasAny(text, [/\bLazyColumn\b/, /\bRecyclerView\b/])) {
      signals.features.add("list");
    }
    if (hasAny(text, [/\bLazyVerticalGrid\b/, /\bGridLayoutManager\b/])) {
      signals.features.add("cards");
    }
    if (hasAny(text, [/\bpullRefresh\b/, /\bPullRefreshIndicator\b/, /\bSwipeRefreshLayout\b/])) {
      signals.features.add("pull_to_refresh");
    }
    if (hasAny(text, [/\bSearchBar\b/, /\bSearchView\b/])) {
      signals.features.add("search");
    }
    if (hasAny(text, [/\bsettings\b/i, /\bpreference(s|screen)?\b/i])) {
      signals.features.add("settings");
    }
    if (hasAny(text, [/\bLinearProgressIndicator\b/, /\bCircularProgressIndicator\b/, /\bProgressBar\b/, /\bskeleton\b/i])) {
      signals.features.add("loading_state");
    }
    if (hasAny(text, [/\bempty state\b/i, /\bNo results\b/, /\bNo items\b/])) {
      signals.features.add("empty_state");
    }
    if (hasAny(text, [/\berror\b/i, /\bSomething went wrong\b/i])) {
      signals.features.add("error_state");
    }
  }

  return signals;
}

function detectIosSignals(rootDir) {
  const files = listFiles(rootDir, (filePath) => /\.(swift|storyboard|xib)$/i.test(filePath));
  const signals = {
    shell: "unknown",
    navigationPatterns: new Set(),
    features: new Set()
  };

  for (const filePath of files) {
    const text = readText(filePath);
    if (hasAny(text, [/\bNavigationStack\b/, /\bNavigationView\b/, /\bUINavigationController\b/])) {
      signals.navigationPatterns.add("stack_navigation");
      if (signals.shell === "unknown") signals.shell = "topbar";
    }
    if (hasAny(text, [/\bTabView\b/, /\bUITabBarController\b/])) {
      signals.navigationPatterns.add("bottom_tabs");
      signals.shell = "bottom_tabs";
    }
    if (hasAny(text, [/\bNavigationSplitView\b/, /\bUISplitViewController\b/])) {
      signals.navigationPatterns.add("split_view");
      signals.features.add("split_view");
      signals.features.add("master_detail");
      signals.shell = "split_view";
    }
    if (hasAny(text, [/\bList\b/, /\bUITableView\b/])) {
      signals.features.add("list");
      signals.features.add("table");
    }
    if (hasAny(text, [/\bForm\b/])) {
      signals.features.add("form");
      signals.features.add("settings");
    }
    if (hasAny(text, [/\bToolbarItem\b/, /\.toolbar\b/, /\bUIToolbar\b/])) {
      signals.features.add("toolbar");
      if (signals.shell === "unknown") signals.shell = "topbar";
    }
    if (hasAny(text, [/\.sheet\s*\(/, /\bUISheetPresentationController\b/])) {
      signals.features.add("sheet");
    }
    if (hasAny(text, [/\.popover\s*\(/, /\bUIPopoverPresentationController\b/])) {
      signals.features.add("popover");
    }
    if (hasAny(text, [/\bUICollectionView\b/])) {
      signals.features.add("cards");
      signals.features.add("gallery");
    }
    if (hasAny(text, [/\.searchable\s*\(/, /\bUISearchController\b/])) {
      signals.features.add("search");
    }
    if (hasAny(text, [/\bPicker\b/, /\bUISegmentedControl\b/])) {
      signals.navigationPatterns.add("segmented_control");
    }
    if (hasAny(text, [/refreshable\s*\{/, /\bUIRefreshControl\b/])) {
      signals.features.add("pull_to_refresh");
    }
    if (hasAny(text, [/\bProgressView\b/, /\bUIActivityIndicatorView\b/, /\bskeleton\b/i])) {
      signals.features.add("loading_state");
    }
    if (hasAny(text, [/\bempty state\b/i, /\bNo results\b/, /\bNo items\b/])) {
      signals.features.add("empty_state");
    }
    if (hasAny(text, [/\berror\b/i, /\bSomething went wrong\b/i])) {
      signals.features.add("error_state");
    }
  }

  return signals;
}

function detectDesktopSignals(rootDir) {
  const files = listFiles(rootDir, (filePath) => /\.(tsx|jsx|ts|js|json|swift|cs|rs|toml|xml|ui|qml)$/i.test(filePath));
  const signals = {
    shell: "unknown",
    navigationPatterns: new Set(),
    features: new Set()
  };

  for (const filePath of files) {
    const text = readText(filePath);
    if (hasAny(text, [/\bMenu\.buildFromTemplate\b/, /\bNSMenu\b/, /\bMenuBar\b/, /\bmenuBar\b/, /\bCommandMenu\b/])) {
      signals.shell = "menu_bar";
      signals.features.add("menu_bar");
    }
    if (hasAny(text, [/\bSidebar\b/, /\bsideBar\b/, /\bSplitView\b/, /\bNavigationRail\b/, /\bSidebarView\b/])) {
      if (signals.shell === "unknown") signals.shell = "sidebar";
      signals.navigationPatterns.add("primary");
    }
    if (hasAny(text, [/\bSplitPane\b/, /\bPanelGroup\b/, /\bQSplitter\b/, /\bNSplitView\b/, /\bPaned\b/, /\bResizablePanel\b/])) {
      signals.features.add("resizable_split");
      signals.features.add("multi_pane_layout");
      if (signals.shell === "unknown") signals.shell = "split_view";
    }
    if (hasAny(text, [/\bCommandPalette\b/, /\bcommand palette\b/i, /\bshowCommandPalette\b/, /\bpalette\b/])) {
      signals.navigationPatterns.add("command_palette");
      signals.features.add("command_palette");
    }
    if (hasAny(text, [/\bInspector\b/, /\bDetailsPane\b/, /\bproperties pane\b/i])) {
      signals.features.add("inspector_pane");
    }
    if (hasAny(text, [/\bBrowserWindow\s*\(/, /\bWindowGroup\b/, /\bNSWindow\b/, /\bgtk_application_window_new\b/])) {
      signals.features.add("multi_window");
    }
    if (hasAny(text, [/\bDataGrid\b|\bag-grid\b|\bAGGrid\b|\bTanStackTable\b|\breact-data-grid\b|\bmui[-_ ]?datagrid\b/i])) {
      signals.features.add("data_grid");
    }
    if (hasAny(text, [/<table\b/, /\bQTableView\b/, /\bNSTableView\b/, /\bDataGridView\b/])) {
      signals.features.add("table");
    }
    if (hasAny(text, [/\bDrawer\b/, /\bSheet\b/, /\bModal\b/])) {
      signals.features.add("drawer");
      signals.features.add("sheet");
    }
    if (hasAny(text, [/\bsettings\b/i, /\bpreferences\b/i])) {
      signals.features.add("settings");
    }
    if (hasAny(text, [/\bspinner\b/i, /\bloading\b/i, /\bskeleton\b/i, /\bProgressRing\b/])) {
      signals.features.add("loading_state");
    }
    if (hasAny(text, [/\bempty state\b/i, /\bNo results\b/, /\bNo items\b/])) {
      signals.features.add("empty_state");
    }
    if (hasAny(text, [/\berror\b/i, /\bSomething went wrong\b/i])) {
      signals.features.add("error_state");
    }
  }

  return signals;
}

function detectSignals(rootDir, platformFamily) {
  if (platformFamily === "android") return detectAndroidSignals(rootDir);
  if (platformFamily === "ios") return detectIosSignals(rootDir);
  if (platformFamily === "desktop") return detectDesktopSignals(rootDir);
  return detectWebSignals(rootDir);
}

function buildPlatformFrequency(repos) {
  return {
    repo_count: repos.length,
    runtimes: countBy(repos.map((repo) => repo.effective_runtime)),
    shells: countBy(repos.map((repo) => repo.shell.shell)),
    navigation_patterns: countNested(repos.map((repo) => repo.navigation_patterns)),
    features: countNested(repos.map((repo) => repo.features))
  };
}

function formatFrequencyList(counts) {
  const entries = Object.entries(counts || {});
  return entries.length > 0 ? entries.map(([name, count]) => `- ${name}: ${count}`).join("\n") : "- _none_";
}

function topKeys(counts, limit = 8) {
  return Object.entries(counts || {}).slice(0, limit).map(([key]) => key);
}

function surveyedPatternRows(findings) {
  const rows = [];
  for (const [pattern, count] of Object.entries(findings.frequency.shells || {})) {
    if (pattern === "unknown") continue;
    rows.push({ pattern, source: "shell", surveyed_count: count });
  }
  for (const [pattern, count] of Object.entries(findings.frequency.navigation_patterns || {})) {
    rows.push({ pattern, source: "navigation", surveyed_count: count });
  }
  for (const [pattern, count] of Object.entries(findings.frequency.features || {})) {
    rows.push({ pattern, source: "feature", surveyed_count: count });
  }
  return rows.sort((a, b) => b.surveyed_count - a.surveyed_count || a.pattern.localeCompare(b.pattern));
}

function buildCoverageMatrix(findings) {
  const validatorText = repoText("engine/src/validator.js");
  const importerText = repoTextAny([
    "engine/src/import/core/shared.js",
    "engine/src/import/core/runner.js",
    "engine/src/import/extractors/ui/react-router.js",
    "engine/src/import/extractors/ui/sveltekit.js",
    "engine/src/import/extractors/ui/android-compose.js",
    "engine/src/import/extractors/ui/swiftui.js"
  ]);
  const generatorText = repoTextAny([
    "engine/src/generator/apps/web/react.js",
    "engine/src/generator/apps/web/sveltekit.js"
  ]);
  const proofExampleText = repoTextAny([
    "examples/todo/topogram/projections/proj-ui-shared.tg",
    "examples/todo/topogram/projections/proj-ui-web.tg",
    "examples/issues/topogram/projections/proj-ui-shared.tg",
    "examples/issues/topogram/projections/proj-ui-web.tg",
    "examples/content-approval/topogram/projections/proj-ui-shared.tg",
    "examples/content-approval/topogram/projections/proj-ui-web.tg"
  ]);

  const modeledByDsl = new Set([
    "topbar",
    "sidebar",
    "bottom_tabs",
    "split_view",
    "menu_bar",
    "table",
    "data_grid",
    "cards",
    "list",
    "board",
    "calendar",
    "gallery",
    "tabs",
    "stack_navigation",
    "segmented_control",
    "command_palette",
    "navigation_rail",
    "breadcrumbs",
    "sheet",
    "bottom_sheet",
    "drawer",
    "modal",
    "popover",
    "search",
    "pull_to_refresh",
    "fab",
    "multi_window",
    "inspector_pane",
    "master_detail",
    "activity",
    "settings",
    "wizard",
    "empty_state",
    "loading_state",
    "error_state",
    "form",
    "menu_bar"
  ]);

  const draftedByProjection = new Set([
    "topbar",
    "sidebar",
    "bottom_tabs",
    "split_view",
    "table",
    "data_grid",
    "cards",
    "list",
    "tabs",
    "stack_navigation",
    "segmented_control",
    "command_palette",
    "search",
    "pull_to_refresh",
    "sheet",
    "bottom_sheet",
    "popover",
    "inspector_pane",
    "multi_window"
  ]);

  const proofTokensByPattern = new Map([
    ["board", ["board", "board_view"]],
    ["calendar", ["calendar", "calendar_view"]],
    ["wizard", ["wizard", "wizard_stepper"]],
    ["settings", ["settings", "settings_section"]],
    ["empty_state", ["empty_state", "empty_state_panel"]]
  ]);

  return surveyedPatternRows(findings).map((row) => {
    const escaped = row.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`);
    const proofRegexes = (proofTokensByPattern.get(row.pattern) || [row.pattern]).map((token) => {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedToken}\\b`);
    });
    return {
      ...row,
      modeled_in_dsl: modeledByDsl.has(row.pattern) || regex.test(validatorText),
      imported: regex.test(importerText),
      drafted: draftedByProjection.has(row.pattern) || regex.test(repoText("engine/src/import/core/runner.js")),
      rendered_web: regex.test(generatorText),
      proof_example: proofRegexes.some((patternRegex) => patternRegex.test(proofExampleText))
    };
  });
}

function buildCoverageReport(findings) {
  const lines = [];
  lines.push("# Topogram UI Coverage");
  lines.push("");
  lines.push("| Pattern | Source | Surveyed | DSL | Import | Draft | Web Render | Proof |");
  lines.push("| --- | --- | ---: | --- | --- | --- | --- | --- |");
  for (const row of findings.coverage_matrix) {
    lines.push(`| ${row.pattern} | ${row.source} | ${row.surveyed_count} | ${row.modeled_in_dsl ? "yes" : "no"} | ${row.imported ? "yes" : "no"} | ${row.drafted ? "yes" : "no"} | ${row.rendered_web ? "yes" : "no"} | ${row.proof_example ? "yes" : "no"} |`);
  }
  lines.push("");
  lines.push("## Weakest Covered");
  lines.push("");
  for (const row of findings.coverage_matrix
    .filter((row) => row.surveyed_count >= 2)
    .filter((row) => !row.rendered_web || !row.proof_example)
    .slice(0, 12)
  ) {
    lines.push(`- ${row.pattern}: surveyed ${row.surveyed_count}, DSL=${row.modeled_in_dsl ? "yes" : "no"}, import=${row.imported ? "yes" : "no"}, draft=${row.drafted ? "yes" : "no"}, web=${row.rendered_web ? "yes" : "no"}, proof=${row.proof_example ? "yes" : "no"}`);
  }
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
}

function buildSummary(findings) {
  const lines = [];
  lines.push("# UI Survey Summary");
  lines.push("");
  lines.push(`Corpus repos: ${findings.stats.corpus_repo_count}`);
  lines.push(`Present and analyzed repos: ${findings.stats.analyzed_repo_count}`);
  lines.push(`Missing or deferred repos: ${findings.stats.missing_repo_count}`);
  lines.push("");
  lines.push("## Platform Families");
  lines.push("");
  lines.push(formatFrequencyList(findings.frequency.platform_families));
  lines.push("");
  lines.push("## Global Runtimes");
  lines.push("");
  lines.push(formatFrequencyList(findings.frequency.runtimes));
  lines.push("");
  lines.push("## Global Shell Modes");
  lines.push("");
  lines.push(formatFrequencyList(findings.frequency.shells));
  lines.push("");
  lines.push("## Global Navigation Patterns");
  lines.push("");
  lines.push(formatFrequencyList(findings.frequency.navigation_patterns));
  lines.push("");
  lines.push("## Global Features");
  lines.push("");
  lines.push(formatFrequencyList(findings.frequency.features));
  lines.push("");
  lines.push("## Coverage Snapshot");
  lines.push("");
  for (const row of findings.coverage_matrix.filter((entry) => entry.surveyed_count >= 4).slice(0, 10)) {
    lines.push(`- ${row.pattern}: DSL=${row.modeled_in_dsl ? "yes" : "no"}, import=${row.imported ? "yes" : "no"}, draft=${row.drafted ? "yes" : "no"}, web=${row.rendered_web ? "yes" : "no"}, proof=${row.proof_example ? "yes" : "no"}`);
  }
  lines.push("");

  for (const platform of ["web", "android", "ios", "desktop"]) {
    const section = findings.by_platform[platform];
    lines.push(`## ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
    lines.push("");
    lines.push(`Repos analyzed: ${section.repo_count}`);
    lines.push("");
    lines.push("### Runtimes");
    lines.push("");
    lines.push(formatFrequencyList(section.runtimes));
    lines.push("");
    lines.push("### Shell Modes");
    lines.push("");
    lines.push(formatFrequencyList(section.shells));
    lines.push("");
    lines.push("### Navigation Patterns");
    lines.push("");
    lines.push(formatFrequencyList(section.navigation_patterns));
    lines.push("");
    lines.push("### Features");
    lines.push("");
    lines.push(formatFrequencyList(section.features));
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildMasterReport(findings) {
  const lines = [];
  lines.push("# Cross-Platform UI Survey Report");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`- Total repos in corpus: ${findings.stats.corpus_repo_count}`);
  lines.push(`- Web repos: ${findings.by_platform.web.repo_count}`);
  lines.push(`- Android repos: ${findings.by_platform.android.repo_count}`);
  lines.push(`- iOS repos: ${findings.by_platform.ios.repo_count}`);
  lines.push(`- Desktop repos: ${findings.by_platform.desktop.repo_count}`);
  lines.push(`- Missing or deferred repos: ${findings.stats.missing_repo_count}`);
  lines.push("");
  lines.push("## Cross-Platform Comparison");
  lines.push("");
  lines.push("| Platform | Dominant runtimes | Common shell modes | Top navigation patterns | Top features |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const platform of ["web", "android", "ios", "desktop"]) {
    const section = findings.by_platform[platform];
    lines.push(
      `| ${platform} | ${topKeys(section.runtimes, 3).join(", ") || "none"} | ${topKeys(section.shells, 3).join(", ") || "none"} | ${topKeys(section.navigation_patterns, 4).join(", ") || "none"} | ${topKeys(section.features, 6).join(", ") || "none"} |`
    );
  }
  lines.push("");
  lines.push("## Standardization Guidance");
  lines.push("");
  lines.push("### Safe To Standardize");
  lines.push("");
  for (const item of findings.decisions.standardize) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("### Keep Platform- or Renderer-Owned");
  lines.push("");
  for (const item of findings.decisions.renderer_owned) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## Topogram Coverage");
  lines.push("");
  lines.push("| Pattern | Surveyed | DSL | Import | Draft | Web Render | Proof |");
  lines.push("| --- | ---: | --- | --- | --- | --- | --- |");
  for (const row of findings.coverage_matrix.filter((entry) => entry.surveyed_count >= 3).slice(0, 18)) {
    lines.push(`| ${row.pattern} | ${row.surveyed_count} | ${row.modeled_in_dsl ? "yes" : "no"} | ${row.imported ? "yes" : "no"} | ${row.drafted ? "yes" : "no"} | ${row.rendered_web ? "yes" : "no"} | ${row.proof_example ? "yes" : "no"} |`);
  }
  lines.push("");

  for (const platform of ["web", "android", "ios", "desktop"]) {
    const section = findings.by_platform[platform];
    lines.push(`## ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
    lines.push("");
    lines.push(`- Repo count: ${section.repo_count}`);
    lines.push(`- Dominant runtimes: ${topKeys(section.runtimes, 5).join(", ") || "none"}`);
    lines.push(`- Common shell modes: ${topKeys(section.shells, 5).join(", ") || "none"}`);
    lines.push(`- Common navigation patterns: ${topKeys(section.navigation_patterns, 8).join(", ") || "none"}`);
    lines.push(`- Common features: ${topKeys(section.features, 10).join(", ") || "none"}`);
    lines.push("");
  }

  lines.push("## Repo Appendix");
  lines.push("");
  for (const repo of findings.repos) {
    lines.push(`### ${repo.id}`);
    lines.push("");
    lines.push(`- Platform: \`${repo.platform_family}\``);
    lines.push(`- Category: \`${repo.category}\``);
    lines.push(`- Repo: \`${repo.repo}\``);
    lines.push(`- Status: ${repo.present ? "analyzed" : "missing_or_deferred"}`);
    lines.push(`- Declared runtime: \`${repo.ui_runtime}\``);
    lines.push(`- Detected runtime: \`${repo.detected_runtime}\``);
    lines.push(`- Effective runtime: \`${repo.effective_runtime}\``);
    lines.push(`- Clone strategy: \`${repo.clone_strategy}\``);
    lines.push(`- Survey priority: \`${repo.survey_priority}\``);
    lines.push(`- Shell: \`${repo.shell.shell}\``);
    lines.push(`- Navigation patterns: ${repo.navigation_patterns.length > 0 ? repo.navigation_patterns.map((item) => `\`${item}\``).join(", ") : "_none_"}`);
    lines.push(`- Features: ${repo.features.length > 0 ? repo.features.map((item) => `\`${item}\``).join(", ") : "_none_"}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function analyzeSurveyAtRoot(surveyRoot = defaultSurveyRoot) {
  const manifestPath = path.join(surveyRoot, "manifest.json");
  const manifest = readJson(manifestPath);
  validateManifest(manifest);

  const repos = manifest.repos.map((entry) => {
    const rootDir = path.join(surveyRoot, entry.path);
    const present = fs.existsSync(rootDir);
    const detectedRuntime = present ? detectRuntime(rootDir, entry.platform_family) : "missing";
    const signals = present
      ? detectSignals(rootDir, entry.platform_family)
      : { shell: "missing", navigationPatterns: new Set(), features: new Set() };
    const effectiveRuntime = detectedRuntime !== "unknown" && detectedRuntime !== "missing" ? detectedRuntime : entry.ui_runtime;

    return {
      ...entry,
      present,
      detected_runtime: detectedRuntime,
      effective_runtime: effectiveRuntime,
      shell: {
        shell: signals.shell
      },
      navigation_patterns: [...signals.navigationPatterns].sort(),
      features: [...signals.features].sort()
    };
  });

  const byPlatform = {};
  for (const platform of ["web", "android", "ios", "desktop"]) {
    byPlatform[platform] = buildPlatformFrequency(repos.filter((repo) => repo.platform_family === platform && repo.present));
  }

  const presentRepos = repos.filter((repo) => repo.present);

  const findings = {
    version: 2,
    generated_at: new Date().toISOString(),
    stats: {
      corpus_repo_count: repos.length,
      analyzed_repo_count: presentRepos.length,
      missing_repo_count: repos.length - presentRepos.length
    },
    repos,
    frequency: {
      platform_families: countBy(repos.map((repo) => repo.platform_family)),
      runtimes: countBy(presentRepos.map((repo) => repo.effective_runtime)),
      shells: countBy(presentRepos.map((repo) => repo.shell.shell)),
      navigation_patterns: countNested(presentRepos.map((repo) => repo.navigation_patterns)),
      features: countNested(presentRepos.map((repo) => repo.features))
    },
    by_platform: byPlatform,
    coverage_matrix: [],
    decisions: {
      standardize: [
        "app_shell",
        "navigation_groups",
        "screen_kinds",
        "screen_states",
        "screen_regions",
        "collection_presentations",
        "action_presentations",
        "semantic_patterns"
      ],
      renderer_owned: [
        "framework_component_props",
        "platform_widget_names",
        "low_level_component_trees",
        "styling_system_details",
        "file_layout_conventions"
      ]
    }
  };

  findings.coverage_matrix = buildCoverageMatrix(findings);

  return {
    findings,
    summary: buildSummary(findings),
    masterReport: buildMasterReport(findings),
    coverageReport: buildCoverageReport(findings)
  };
}

export function writeSurveyAnalysis(surveyRoot = defaultSurveyRoot) {
  const analysisDir = path.join(surveyRoot, "analysis");
  const findingsPath = path.join(analysisDir, "normalized-findings.json");
  const summaryPath = path.join(analysisDir, "summary.md");
  const masterReportPath = path.join(analysisDir, "master-report.md");
  const coverageReportPath = path.join(analysisDir, "coverage-report.md");
  const { findings, summary, masterReport, coverageReport } = analyzeSurveyAtRoot(surveyRoot);

  ensureDir(analysisDir);
  fs.writeFileSync(findingsPath, `${JSON.stringify(findings, null, 2)}\n`, "utf8");
  fs.writeFileSync(summaryPath, summary, "utf8");
  fs.writeFileSync(masterReportPath, masterReport, "utf8");
  fs.writeFileSync(coverageReportPath, coverageReport, "utf8");

  for (const platform of ["web", "android", "ios", "desktop"]) {
    const platformPath = path.join(analysisDir, `normalized-findings.${platform}.json`);
    fs.writeFileSync(
      platformPath,
      `${JSON.stringify({
        version: findings.version,
        generated_at: findings.generated_at,
        platform_family: platform,
        repos: findings.repos.filter((repo) => repo.platform_family === platform),
        frequency: findings.by_platform[platform]
      }, null, 2)}\n`,
      "utf8"
    );
  }

  return {
    findingsPath,
    summaryPath,
    masterReportPath,
    coverageReportPath
  };
}

export function main() {
  const { findingsPath, summaryPath, masterReportPath, coverageReportPath } = writeSurveyAnalysis(defaultSurveyRoot);
  process.stdout.write(`Wrote ${findingsPath}\nWrote ${summaryPath}\nWrote ${masterReportPath}\nWrote ${coverageReportPath}\n`);
}

const directRunPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = path.resolve(new URL(import.meta.url).pathname);

if (directRunPath === modulePath) {
  main();
}
