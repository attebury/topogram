import { buildWebRealization } from "../../../realization/ui/index.js";
import { getExampleImplementation } from "../../../example-implementation.js";
import { renderApiClientModule, renderLookupModule, renderVisibilityModule } from "./shared.js";

function componentNameForScreen(screenId) {
  return screenId
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") + "Page";
}

function buildReactClientModule(webReference) {
  return renderApiClientModule("react", webReference);
}

function buildLookupModule(webReference) {
  return renderLookupModule("react", webReference.defaultApiBaseUrl || "http://localhost:3000");
}

function buildReactVisibilityModule() {
  return renderVisibilityModule("react");
}

function resolveNavLinks(contract, webReference) {
  const contractLinks = (contract.navigation?.items || [])
    .filter((item) => item.visible && item.route && item.placement === "primary")
    .sort((a, b) => String(a.order || "").localeCompare(String(b.order || "")) || a.label.localeCompare(b.label))
    .map((item) => ({ label: item.label, route: item.route }));
  if (contractLinks.length > 0) {
    return contractLinks;
  }
  return Array.isArray(webReference.nav?.links) && webReference.nav.links.length > 0
    ? webReference.nav.links
    : [
        { label: webReference.nav.browseLabel, route: webReference.nav.browseRoute },
        { label: webReference.nav.createLabel, route: webReference.nav.createRoute }
      ];
}

function buildAppTsx(contract, webReference) {
  const navLinks = resolveNavLinks(contract, webReference);
  const brandName = contract.appShell?.brand || webReference.brandName;
  const footerEnabled = contract.appShell?.footer && contract.appShell.footer !== "none";
  const shellMode = contract.appShell?.shell || "topbar";
  const windowingMode = contract.appShell?.windowing || "single_window";
  const navigationPatterns = (contract.navigation?.patterns || []).join(" ");
  const hasCommandPalette = (contract.navigation?.patterns || []).includes("command_palette");
  const navItems = navLinks.map((link) => `            <Link to="${link.route}">${link.label}</Link>`).join("\n");
  const routeScreens = contract.screens.filter((screen) => screen.route && componentNameForScreen(screen.id) !== "EditorialSettingsPage");
  const importLines = routeScreens
    .map((screen) => `import { ${componentNameForScreen(screen.id)} } from "./pages/${componentNameForScreen(screen.id)}";`)
    .join("\n");
  const routeLines = routeScreens
    .map((screen) => `            <Route path="${screen.route}" element={<${componentNameForScreen(screen.id)} />} />`)
    .join("\n");

  const shellFrame =
    shellMode === "split_view"
      ? `        <div className="app-workspace">
          <aside className="app-sidebar">
            <Link className="brand" to="/">${brandName}</Link>
            <nav className="app-nav-links">
${navItems}
            </nav>
${hasCommandPalette ? `            <button className="command-palette-button" type="button">Command Palette</button>` : ""}
          </aside>
          <div className="app-main-shell">
            <header className="app-nav compact">
              <div className="brand-mark">${brandName}</div>
${hasCommandPalette ? `              <button className="command-palette-button" type="button">Command Palette</button>` : ""}
            </header>
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
${routeLines}
              </Routes>
            </main>
          </div>
        </div>`
      : shellMode === "bottom_tabs"
        ? `        <header className="app-nav">
          <Link className="brand" to="/">${brandName}</Link>
${hasCommandPalette ? `          <button className="command-palette-button" type="button">Command Palette</button>` : ""}
        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
${routeLines}
          </Routes>
        </main>
        <nav className="app-tabbar">
${navItems}
        </nav>`
        : `        <header className="app-nav${shellMode === "menu_bar" ? " menu-bar" : ""}">
          <Link className="brand" to="/">${brandName}</Link>
          <nav className="app-nav-links">
${navItems}
          </nav>
${hasCommandPalette ? `          <button className="command-palette-button" type="button">Command Palette</button>` : ""}
        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
${routeLines}
          </Routes>
        </main>`;

  return `import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
${importLines}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell" data-shell="${shellMode}" data-windowing="${windowingMode}" data-navigation-patterns="${navigationPatterns}">
${shellFrame}
${footerEnabled ? `        <footer className="app-footer">
          <span>Generated from Topogram</span>
        </footer>
` : ""}
      </div>
    </BrowserRouter>
  );
}
`;
}

function buildReactScaffold(realization, graph) {
  const implementation = getExampleImplementation(graph);
  const webReference = implementation.web.reference;
  const runtimeReference = implementation.runtime.reference;
  const webReferenceWithDefaults = {
    ...webReference,
    defaultApiBaseUrl: `http://localhost:${runtimeReference?.ports?.server || 3000}`
  };
  const webScreenReference = implementation.web.screenReference;
  const webRenderers = implementation.web.renderers;
  const contract = realization.contract;
  const files = {};

  const listScreen = contract.screens.find((screen) => screen.id === webScreenReference.listScreenId);
  const detailScreen = contract.screens.find((screen) => screen.id === webScreenReference.detailScreenId);
  const createScreen = contract.screens.find((screen) => screen.id === webScreenReference.createScreenId);
  const editScreen = contract.screens.find((screen) => screen.id === webScreenReference.editScreenId);
  const taskExports = webScreenReference.exportsScreenId
    ? contract.screens.find((screen) => screen.id === webScreenReference.exportsScreenId)
    : null;
  const listLookups = Object.fromEntries((listScreen?.lookups || []).map((lookup) => [lookup.field, { ...lookup, route: `/lookups/${lookup.entity.id.replace(/^entity_/, "")}s` }]));
  const createLookups = Object.fromEntries((createScreen?.lookups || []).map((lookup) => [lookup.field, { ...lookup, route: `/lookups/${lookup.entity.id.replace(/^entity_/, "")}s` }]));
  const editLookups = Object.fromEntries((editScreen?.lookups || []).map((lookup) => [lookup.field, { ...lookup, route: `/lookups/${lookup.entity.id.replace(/^entity_/, "")}s` }]));

  files["package.json"] = `${JSON.stringify({
    name: contract.projection.id,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite dev",
      build: "vite build",
      preview: "vite preview",
      check: "tsc --noEmit"
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.30.1"
    },
    devDependencies: {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.7.0",
      typescript: "^5.6.3",
      vite: "^7.1.11"
    }
  }, null, 2)}\n`;
  files["tsconfig.json"] = `${JSON.stringify({
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      allowJs: false,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      module: "ESNext",
      moduleResolution: "Node",
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx"
    },
    include: ["src"]
  }, null, 2)}\n`;
  files["vite.config.ts"] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "PUBLIC_TOPOGRAM_", "TOPOGRAM_"]
});
`;
  files["index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${webReference.brandName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  files["src/main.tsx"] = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  files["src/vite-env.d.ts"] = `/// <reference types="vite/client" />\n`;
  files["src/app.css"] = `:root {
  font-family: system-ui, sans-serif;
  color: #182026;
  background: linear-gradient(180deg, #f5f7fb 0%, #edf2f7 100%);
}
body { margin: 0; }
a { color: #0f5cc0; text-decoration: none; }
a:hover { text-decoration: underline; }
main { max-width: 72rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.app-shell { min-height: 100vh; }
.app-workspace { display: grid; grid-template-columns: 18rem minmax(0, 1fr); min-height: 100vh; }
.app-main-shell { min-width: 0; }
.app-sidebar { position: sticky; top: 0; align-self: start; min-height: 100vh; display: grid; align-content: start; gap: 1rem; padding: 1.25rem 1rem; border-right: 1px solid rgba(24, 32, 38, 0.08); background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(12px); }
.app-nav { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(24, 32, 38, 0.08); background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); }
.app-nav-links, .app-nav nav, .app-tabbar { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.app-nav.menu-bar { border-bottom-style: dashed; }
.app-nav.compact { justify-content: flex-end; }
.app-tabbar { position: sticky; bottom: 0; z-index: 10; justify-content: space-around; padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid rgba(24, 32, 38, 0.08); background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(12px); }
.brand { font-weight: 700; letter-spacing: 0.01em; }
.brand-mark { font-weight: 700; color: #607284; }
.command-palette-button { background: #182026; color: white; border: none; border-radius: 999px; padding: 0.6rem 0.9rem; font: inherit; cursor: pointer; }
.app-footer { max-width: 72rem; margin: 0 auto; padding: 0 1.25rem 2rem; color: #607284; }
.card { background: white; border-radius: 16px; padding: 1.25rem; box-shadow: 0 12px 30px rgba(24, 32, 38, 0.08); }
.hero, .stack, .grid, .filters, .task-meta, .resource-meta, .definition-list { display: grid; gap: 1rem; }
.grid.two { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.filters { grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin: 1rem 0 1.25rem; }
label { display: grid; gap: 0.35rem; font-size: 0.95rem; }
input, textarea, button, select { font: inherit; }
input, textarea, select { width: 100%; box-sizing: border-box; border: 1px solid #c9d4e2; border-radius: 12px; padding: 0.7rem 0.85rem; background: white; }
textarea { min-height: 8rem; resize: vertical; }
button, .button-link { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; border: none; border-radius: 999px; padding: 0.7rem 1rem; background: #0f5cc0; color: white; font-weight: 600; cursor: pointer; }
.button-link.secondary { background: #e9eef6; color: #182026; }
.button-row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.task-list, .resource-list { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
.task-list li, .resource-list li { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem; border: 1px solid #e0e8f1; border-radius: 14px; background: #fbfcfe; }
.table-wrap { margin-top: 1rem; overflow-x: auto; border: 1px solid #d7e1ec; border-radius: 14px; background: white; }
.resource-table { width: 100%; border-collapse: collapse; min-width: 42rem; }
.resource-table th, .resource-table td { padding: 0.85rem 1rem; text-align: left; border-bottom: 1px solid #e7edf5; vertical-align: top; }
.resource-table th { font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase; color: #516173; background: #f8fbff; }
.resource-table tbody tr:hover { background: #fbfdff; }
.data-grid { min-width: 64rem; font-size: 0.95rem; }
.data-grid thead th { position: sticky; top: 0; z-index: 1; background: #eef5ff; }
.data-grid-shell { box-shadow: inset 0 0 0 1px rgba(15, 92, 192, 0.04); }
.cell-stack { display: grid; gap: 0.35rem; }
.cell-secondary { color: #607284; font-size: 0.92rem; }
.definition-list { grid-template-columns: minmax(8rem, 12rem) 1fr; align-items: start; }
.definition-list dt { font-weight: 600; color: #516173; }
.definition-list dd { margin: 0; }
.badge { display: inline-flex; align-items: center; padding: 0.25rem 0.6rem; border-radius: 999px; background: #eef4ff; color: #0f5cc0; font-size: 0.85rem; font-weight: 600; }
.muted { color: #607284; }
.empty-state { padding: 1rem 0; }
.error-text { color: #b42318; }
@media (max-width: 900px) { .app-workspace { grid-template-columns: 1fr; } .app-sidebar { position: static; min-height: auto; border-right: none; border-bottom: 1px solid rgba(24, 32, 38, 0.08); } }
@media (max-width: 640px) { .definition-list { grid-template-columns: 1fr; } .task-list li, .resource-list li { flex-direction: column; } .resource-table { min-width: 36rem; } .app-nav { flex-wrap: wrap; } }
`;
  files["src/App.tsx"] = buildAppTsx(contract, webReferenceWithDefaults);
  files["src/lib/topogram/api-contracts.json"] = `${JSON.stringify(realization.apiContracts, null, 2)}\n`;
  files["src/lib/topogram/ui-web-contract.json"] = `${JSON.stringify(contract, null, 2)}\n`;
  files["src/lib/auth/visibility.ts"] = buildReactVisibilityModule();
  files["src/lib/api/client.ts"] = buildReactClientModule(webReferenceWithDefaults);
  files["src/lib/api/lookups.ts"] = buildLookupModule(webReferenceWithDefaults);
  files["src/pages/HomePage.tsx"] = webRenderers.renderHomePage({
    screens: contract.screens.map((screen) => ({
      id: screen.id,
      title: screen.title || screen.id,
      route: screen.route,
      navigable: Boolean(screen.route) && !screen.route.includes(":")
    })),
    projectionName: contract.projection.name,
    homeDescription: webReference.home.heroDescriptionTemplate.replace("PROFILE", "`react`"),
    webReference
  });

  if (listScreen?.route && detailScreen?.route && createScreen?.route && editScreen?.route) {
    const pageFiles = webRenderers.renderRoutes({
      listScreen,
      detailScreen,
      createScreen,
      editScreen,
      taskList: listScreen,
      taskDetail: detailScreen,
      taskCreate: createScreen,
      taskEdit: editScreen,
      taskExports,
      listLookups,
      createLookups,
      editLookups,
      taskListLookups: listLookups,
      taskCreateLookups: createLookups,
      taskEditLookups: editLookups,
      defaultContainerEnvVar: webReference.createPrimary.defaultContainerEnvVar,
      defaultAssigneeEnvVar: webReference.createPrimary.defaultAssigneeEnvVar,
      projectEnvVar: webReference.createPrimary.defaultContainerEnvVar,
      ownerEnvVar: webReference.createPrimary.defaultAssigneeEnvVar,
      webReference,
      prettyScreenKind: (kind) => String(kind || "screen").replace(/_/g, " ")
    });
    for (const [relativePath, contents] of Object.entries(pageFiles)) {
      files[`src/pages/${relativePath}`] = contents;
    }
  }

  return files;
}

export function generateReactApp(graph, options = {}) {
  const realization = buildWebRealization(graph, options);
  return buildReactScaffold(realization, graph);
}
