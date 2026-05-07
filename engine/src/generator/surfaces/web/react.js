import { buildWebRealization } from "../../../realization/ui/index.js";
import { getExampleImplementation } from "../../../example-implementation.js";
import {
  reactComponentUsageSupport,
  renderReactComponentRegion
} from "./react-components.js";
import { buildDesignIntentCoverage, renderDesignIntentCss } from "./design-intent.js";
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

function routeSamplePath(route) {
  return String(route || "/").replace(/:([A-Za-z0-9_]+)/g, "sample-$1");
}

function screenRegions(screen) {
  const names = new Set();
  for (const region of screen?.regions || []) {
    if (region?.name) names.add(region.name);
  }
  for (const usage of screen?.components || []) {
    if (usage?.region) names.add(usage.region);
  }
  return [...names];
}

function sampleItemsForScreen(screen) {
  const title = screen?.title || screen?.id || "Resource";
  return [
    {
      id: "sample-active",
      title: `${title} sample`,
      name: `${title} sample`,
      message: `${title} sample`,
      description: "Generated from Topogram UI contract metadata.",
      status: "active",
      priority: "medium",
      created_at: "2026-01-01"
    },
    {
      id: "sample-completed",
      title: `${title} completed sample`,
      name: `${title} completed sample`,
      message: `${title} completed sample`,
      description: "Second generated row for component rendering checks.",
      status: "completed",
      priority: "low",
      created_at: "2026-01-02"
    }
  ];
}

function buildReactHomePage(contract, webReference) {
  const screens = contract.screens.map((screen) => ({
    id: screen.id,
    title: screen.title || screen.id,
    route: screen.route,
    sampleRoute: routeSamplePath(screen.route),
    navigable: Boolean(screen.route)
  }));
  const homeDescription = webReference.home.heroDescriptionTemplate.replace("PROFILE", "`react`");
  return `import { Link } from "react-router-dom";

const screens = ${JSON.stringify(screens, null, 2)};

export function HomePage() {
  return (
    <main>
      <div className="stack">
        <section className="card hero">
          <div>
            <p className="muted">Generated starter</p>
            <h1>${contract.projection.name}</h1>
            <p>${homeDescription}</p>
          </div>
          <div className="button-row">
            {screens.filter((screen) => screen.navigable).slice(0, 2).map((screen) => (
              <Link className="button-link" to={screen.sampleRoute} key={screen.id}>{screen.title}</Link>
            ))}
          </div>
        </section>

        <section className="grid two">
          {screens.map((screen) => (
            <article className="card" key={screen.id}>
              <h2>{screen.title}</h2>
              {screen.navigable ? (
                <p><Link to={screen.sampleRoute}>Open screen</Link></p>
              ) : (
                <p className="muted">Contract-only screen</p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
`;
}

function buildReactScreenPage(screen, contract) {
  const sampleItems = sampleItemsForScreen(screen);
  const renderedRegions = screenRegions(screen)
    .map((region) => {
      const rendered = renderReactComponentRegion(screen, region, {
        componentContracts: contract.components,
        itemsExpression: "items",
        useTypescript: true
      });
      if (!rendered) return "";
      return `        <section className="stack" data-topogram-region="${region}">
${rendered}
        </section>`;
    })
    .filter(Boolean)
    .join("\n\n");
  const defaultCollection = `<section className="card">
          <h2>Sample rows</h2>
          <ul className="resource-list">
            {items.map((item: any) => (
              <li key={item.id}>
                <div className="resource-meta">
                  <strong>{item.title}</strong>
                  <span className="muted">{item.description}</span>
                </div>
                <span className="badge">{item.status}</span>
              </li>
            ))}
          </ul>
        </section>`;

  return `const items: any[] = ${JSON.stringify(sampleItems, null, 2)};

export function ${componentNameForScreen(screen.id)}() {
  return (
    <main>
      <div className="stack">
        <section className="card">
          <div className="button-row" style={{ justifyContent: "space-between" }}>
            <div>
              <p className="muted">${screen.kind || "screen"}</p>
              <h1>${screen.title || screen.id}</h1>
              <p>This React page was generated from <code>${screen.id}</code>.</p>
            </div>
          </div>
        </section>

${renderedRegions || `        ${defaultCollection}`}
      </div>
    </main>
  );
}
`;
}

function screenComponentUsages(screen) {
  return Array.isArray(screen?.components) ? screen.components : [];
}

function screenPagePath(screen) {
  return `src/pages/${componentNameForScreen(screen.id)}.tsx`;
}

function buildReactGenerationCoverage(contract, files, routeScreens) {
  const diagnostics = [];
  const designIntent = buildDesignIntentCoverage(contract, files, "src/app.css");
  diagnostics.push(...designIntent.diagnostics);
  const routeScreenIds = new Set(routeScreens.map((screen) => screen.id));
  const screens = (contract.screens || [])
    .filter((screen) => routeScreenIds.has(screen.id))
    .map((screen) => {
      const pagePath = screenPagePath(screen);
      const contents = files[pagePath] || "";
      const rendered = Boolean(contents);
      if (!rendered) {
        diagnostics.push({
          code: "screen_route_not_rendered",
          severity: "error",
          screen: screen.id,
          route: screen.route,
          message: `Screen '${screen.id}' has route '${screen.route}' but no React page was generated.`,
          suggested_fix: "Check the React generator contract-complete route emission for this screen."
        });
      }
      const componentUsages = screenComponentUsages(screen).map((usage) => {
        const componentId = usage.component?.id || null;
        const marker = componentId ? `data-topogram-component="${componentId}"` : null;
        const support = reactComponentUsageSupport(usage, contract.components);
        const usageRendered = Boolean(marker && contents.includes(marker));
        if (componentId && rendered && !support.supported) {
          diagnostics.push({
            code: "component_pattern_not_supported",
            severity: "error",
            screen: screen.id,
            route: screen.route,
            region: usage.region || null,
            pattern: support.pattern || null,
            component: componentId,
            message: `Screen '${screen.id}' uses component '${componentId}' with unsupported React component pattern '${support.pattern || "(missing)"}'.`,
            suggested_fix: "Use a supported component pattern for this generator or provide an implementation override."
          });
        }
        if (componentId && rendered && !usageRendered) {
          diagnostics.push({
            code: "component_usage_not_rendered",
            severity: "warning",
            screen: screen.id,
            route: screen.route,
            region: usage.region || null,
            component: componentId,
            message: `Screen '${screen.id}' uses component '${componentId}' but the generated React page does not contain its component marker.`,
            suggested_fix: "Render the component region with renderReactComponentRegion or add a supported component pattern."
          });
        }
        return {
          component: componentId,
          region: usage.region || null,
          pattern: support.pattern || null,
          supported: support.supported,
          rendered: usageRendered,
          marker
        };
      });
      return {
        id: screen.id,
        route: screen.route,
        page: pagePath,
        rendered,
        renderer: rendered ? "generator" : "missing",
        component_usages: componentUsages
      };
    });

  return {
    type: "generation_coverage",
    surface: "web",
    generator: "topogram/react",
    projection: {
      id: contract.projection.id,
      name: contract.projection.name,
      platform: contract.projection.platform
    },
    summary: {
      routed_screens: screens.length,
      rendered_screens: screens.filter((screen) => screen.rendered).length,
      implementation_screens: 0,
      generator_screens: screens.filter((screen) => screen.renderer === "generator").length,
      component_usages: screens.reduce((total, screen) => total + screen.component_usages.length, 0),
      rendered_component_usages: screens.reduce(
        (total, screen) => total + screen.component_usages.filter((usage) => usage.rendered).length,
        0
      ),
      diagnostics: diagnostics.length,
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
    },
    design_intent: designIntent.coverage,
    screens,
    diagnostics
  };
}

function assertGenerationCoverage(coverage) {
  const errors = (coverage.diagnostics || []).filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length === 0) {
    return;
  }
  const details = errors.map((diagnostic) => diagnostic.message).join("; ");
  throw new Error(`React generation coverage failed: ${details}`);
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

function buildReactScaffold(realization, graph, options = {}) {
  const implementation = getExampleImplementation(graph, options);
  const webReference = implementation.web.reference;
  const runtimeReference = implementation.runtime.reference;
  const webReferenceWithDefaults = {
    ...webReference,
    defaultApiBaseUrl: `http://localhost:${runtimeReference?.ports?.server || 3000}`
  };
  const contract = realization.contract;
  const routeScreens = contract.screens.filter((screen) => screen.route && componentNameForScreen(screen.id) !== "EditorialSettingsPage");
  const files = {};

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
  files["src/app.css"] = `${renderDesignIntentCss(contract.design)}

:root {
  font-family: system-ui, sans-serif;
  color: var(--topogram-text-color);
  background: var(--topogram-surface-background);
}
body { margin: 0; }
a { color: var(--topogram-action-primary-background); text-decoration: none; }
a:hover { text-decoration: underline; }
main { max-width: 72rem; margin: 0 auto; padding: var(--topogram-page-padding); }
.app-shell { min-height: 100vh; }
.app-workspace { display: grid; grid-template-columns: 18rem minmax(0, 1fr); min-height: 100vh; }
.app-main-shell { min-width: 0; }
.app-sidebar { position: sticky; top: 0; align-self: start; min-height: 100vh; display: grid; align-content: start; gap: var(--topogram-space-unit); padding: 1.25rem 1rem; border-right: 1px solid rgba(24, 32, 38, 0.08); background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(12px); }
.app-nav { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: var(--topogram-space-unit); padding: 1rem 1.25rem; border-bottom: 1px solid rgba(24, 32, 38, 0.08); background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); }
.app-nav-links, .app-nav nav, .app-tabbar { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.app-nav.menu-bar { border-bottom-style: dashed; }
.app-nav.compact { justify-content: flex-end; }
.app-tabbar { position: sticky; bottom: 0; z-index: 10; justify-content: space-around; padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid rgba(24, 32, 38, 0.08); background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(12px); }
.brand { font-weight: 700; letter-spacing: 0.01em; }
.brand-mark { font-weight: 700; color: var(--topogram-muted-color); }
.command-palette-button { background: var(--topogram-text-color); color: white; border: none; border-radius: var(--topogram-radius-pill); padding: var(--topogram-control-padding); font: inherit; cursor: pointer; }
.app-footer { max-width: 72rem; margin: 0 auto; padding: 0 1.25rem 2rem; color: var(--topogram-muted-color); }
.card { background: var(--topogram-surface-card); border-radius: var(--topogram-radius-card); padding: 1.25rem; box-shadow: 0 12px 30px rgba(24, 32, 38, 0.08); }
.hero, .stack, .grid, .filters, .resource-meta, .definition-list { display: grid; gap: var(--topogram-space-unit); }
.grid.two { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.filters { grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin: 1rem 0 1.25rem; }
label { display: grid; gap: 0.35rem; font-size: 0.95rem; }
input, textarea, button, select { font: inherit; }
input, textarea, select { width: 100%; box-sizing: border-box; border: 1px solid #c9d4e2; border-radius: var(--topogram-radius-control); padding: var(--topogram-control-padding); background: white; }
textarea { min-height: 8rem; resize: vertical; }
button, .button-link { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; border: none; border-radius: var(--topogram-radius-pill); padding: var(--topogram-control-padding); background: var(--topogram-action-primary-background); color: var(--topogram-action-primary-color); font-weight: 600; cursor: pointer; }
button:focus-visible, .button-link:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: var(--topogram-focus-outline); outline-offset: 2px; }
.button-link.secondary { background: #e9eef6; color: var(--topogram-text-color); }
.button-row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.resource-list { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
.resource-list li { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--topogram-space-unit); padding: 1rem; border: 1px solid #e0e8f1; border-radius: var(--topogram-radius-card); background: var(--topogram-surface-subtle); }
.table-wrap { margin-top: 1rem; overflow-x: auto; border: 1px solid var(--topogram-border-color); border-radius: var(--topogram-radius-card); background: white; }
.resource-table { width: 100%; border-collapse: collapse; min-width: 42rem; }
.resource-table th, .resource-table td { padding: 0.85rem 1rem; text-align: left; border-bottom: 1px solid #e7edf5; vertical-align: top; }
.resource-table th { font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase; color: #516173; background: #f8fbff; }
.resource-table tbody tr:hover { background: #fbfdff; }
.data-grid { min-width: 64rem; font-size: 0.95rem; }
.data-grid thead th { position: sticky; top: 0; z-index: 1; background: #eef5ff; }
.data-grid-shell { box-shadow: inset 0 0 0 1px rgba(15, 92, 192, 0.04); }
.cell-stack { display: grid; gap: 0.35rem; }
.cell-secondary { color: var(--topogram-muted-color); font-size: 0.92rem; }
.definition-list { grid-template-columns: minmax(8rem, 12rem) 1fr; align-items: start; }
.definition-list dt { font-weight: 600; color: #516173; }
.definition-list dd { margin: 0; }
.badge { display: inline-flex; align-items: center; padding: 0.25rem 0.6rem; border-radius: var(--topogram-radius-pill); background: #eef4ff; color: var(--topogram-action-primary-background); font-size: 0.85rem; font-weight: 600; }
.muted { color: var(--topogram-muted-color); }
.empty-state { padding: 1rem 0; }
.error-text { color: #b42318; }
.component-card { border: 1px solid var(--topogram-border-color); border-radius: var(--topogram-radius-card); background: var(--topogram-surface-subtle); padding: 1rem; margin-top: 1rem; }
.component-header { display: flex; align-items: center; justify-content: space-between; gap: var(--topogram-space-unit); flex-wrap: wrap; }
.component-eyebrow { margin: 0 0 0.25rem; color: var(--topogram-muted-color); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.component-card h2, .component-card h3 { margin: 0; }
.component-table-wrap { margin-top: 1rem; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.75rem; }
.summary-grid div, .board-column { border: 1px solid #e0e8f1; border-radius: var(--topogram-radius-control); background: white; padding: 0.85rem; }
.summary-grid strong { display: block; font-size: 1.5rem; }
.summary-grid span, .calendar-list span { color: var(--topogram-muted-color); font-size: 0.9rem; }
.board-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.board-card, .calendar-card { display: grid; gap: 0.25rem; border: 1px solid #e0e8f1; border-radius: var(--topogram-radius-control); background: #f8fbff; padding: 0.75rem; }
.calendar-list { display: grid; gap: 0.75rem; margin-top: 1rem; }
@media (max-width: 900px) { .app-workspace { grid-template-columns: 1fr; } .app-sidebar { position: static; min-height: auto; border-right: none; border-bottom: 1px solid rgba(24, 32, 38, 0.08); } }
@media (max-width: 640px) { .definition-list { grid-template-columns: 1fr; } .resource-list li { flex-direction: column; } .resource-table { min-width: 36rem; } .app-nav { flex-wrap: wrap; } }
`;
  files["src/App.tsx"] = buildAppTsx(contract, webReferenceWithDefaults);
  files["src/lib/topogram/api-contracts.json"] = `${JSON.stringify(realization.apiContracts, null, 2)}\n`;
  files["src/lib/topogram/ui-web-contract.json"] = `${JSON.stringify(contract, null, 2)}\n`;
  files["src/lib/auth/visibility.ts"] = buildReactVisibilityModule();
  files["src/lib/api/client.ts"] = buildReactClientModule(webReferenceWithDefaults);
  files["src/lib/api/lookups.ts"] = buildLookupModule(webReferenceWithDefaults);
  files["src/pages/HomePage.tsx"] = buildReactHomePage(contract, webReferenceWithDefaults);

  for (const screen of routeScreens) {
    files[screenPagePath(screen)] = buildReactScreenPage(screen, contract);
  }

  const coverage = buildReactGenerationCoverage(contract, files, routeScreens);
  assertGenerationCoverage(coverage);
  files["src/lib/topogram/generation-coverage.json"] = `${JSON.stringify(coverage, null, 2)}\n`;
  return files;
}

export function generateReactApp(graph, options = {}) {
  const realization = buildWebRealization(graph, options);
  return buildReactScaffold(realization, graph, options);
}
