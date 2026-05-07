import { buildWebRealization } from "../../../realization/ui/index.js";
import { lookupRouteSegment } from "../services/runtime-helpers.js";
import { getExampleImplementation } from "../../../example-implementation.js";
import { renderApiClientModule, renderLookupModule, renderVisibilityModule } from "./shared.js";
import { buildDesignIntentCoverage, renderDesignIntentCss } from "./design-intent.js";
import {
  renderSvelteKitComponentRegion,
  svelteKitComponentUsageSupport
} from "./sveltekit-components.js";

function routePathToSvelteKitDirectory(routePath) {
  if (!routePath || routePath === "/") {
    return "src/routes";
  }
  const segments = routePath
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith(":") ? `[${segment.slice(1)}]` : segment));
  return `src/routes/${segments.join("/")}`;
}

function prettyScreenKind(kind) {
  return kind ? kind.replace(/_/g, " ") : "screen";
}

function lookupDescriptor(lookup) {
  if (!lookup?.entity?.id) {
    return null;
  }

  return {
    ...lookup,
    route: `/lookups/${lookupRouteSegment(lookup.entity.id)}`
  };
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
      created_at: "2026-01-01",
      due_at: "2026-01-15"
    },
    {
      id: "sample-completed",
      title: `${title} completed sample`,
      name: `${title} completed sample`,
      message: `${title} completed sample`,
      description: "Second generated row for component rendering checks.",
      status: "completed",
      priority: "low",
      created_at: "2026-01-02",
      due_at: "2026-01-22"
    }
  ];
}

function isDynamicRoute(route) {
  return String(route || "").split("/").some((segment) => segment.startsWith(":"));
}

function screenRoutePagePath(screen) {
  return `${routePathToSvelteKitDirectory(screen.route)}/+page.svelte`;
}

function screenComponentUsages(screen) {
  return Array.isArray(screen?.components) ? screen.components : [];
}

function buildGenericSvelteKitScreenFiles(screen, contract, useTypescript) {
  const files = {};
  const routeDir = routePathToSvelteKitDirectory(screen.route);
  const sampleItems = sampleItemsForScreen(screen);
  const loadCapabilityId = screen.loadCapability?.id || null;
  const canLoadFromApi = loadCapabilityId && !isDynamicRoute(screen.route);
  const renderedRegions = screenRegions(screen)
    .map((region) => {
      const rendered = renderSvelteKitComponentRegion(screen, region, {
        componentContracts: contract.components,
        itemsExpression: "data.result.items",
        useTypescript
      });
      if (!rendered) return "";
      return `      <section class="stack" data-topogram-region="${region}">
        ${rendered}
      </section>`;
    })
    .filter(Boolean)
    .join("\n\n");
  const defaultCollection = `<section class="card">
      <h2>Sample rows</h2>
      <ul class="resource-list">
        {#each data.result.items as item}
          <li>
            <div class="resource-meta">
              <strong>{item.title ?? item.name ?? item.message ?? item.id}</strong>
              {#if item.description}<span class="muted">{item.description}</span>{/if}
            </div>
            <span class="badge">{item.status ?? "active"}</span>
          </li>
        {/each}
      </ul>
    </section>`;

  if (canLoadFromApi) {
    files[`${routeDir}/+page.ts`] = `import type { PageLoad } from "./$types";
import { requestCapability } from "$lib/api/client";

export const load: PageLoad = async ({ fetch }) => {
  const result = await requestCapability(fetch, "${loadCapabilityId}");
  const resultObject = result && typeof result === "object" && !Array.isArray(result) ? result : {};
  return {
    screen: ${JSON.stringify({ id: screen.id, title: screen.title, collection: screen.collection, web: screen.web }, null, 2)},
    result: Array.isArray(result) ? { items: result } : { items: resultObject.items ?? [], ...resultObject }
  };
};
`;
  }

  files[`${routeDir}/+page.svelte`] = `<script${useTypescript ? ' lang="ts"' : ""}>
  ${canLoadFromApi ? "export let data;" : `const data = {
    screen: ${JSON.stringify({ id: screen.id, title: screen.title, collection: screen.collection, web: screen.web }, null, 2)},
    result: {
      items: ${JSON.stringify(sampleItems, null, 2)}
    }
  };`}
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <p class="muted">${screen.kind || "screen"}</p>
          <h1>${screen.title || screen.id}</h1>
          <p>This SvelteKit page was generated from <code>${screen.id}</code>.</p>
        </div>
      </div>
    </section>

${renderedRegions || `    ${defaultCollection}`}
  </div>
</main>
`;
  return files;
}

function buildSvelteKitGenerationCoverage(contract, files, implementationScreenIds) {
  const diagnostics = [];
  const designIntent = buildDesignIntentCoverage(contract, files, "src/app.css");
  diagnostics.push(...designIntent.diagnostics);
  const screens = (contract.screens || [])
    .filter((screen) => Boolean(screen.route) && screen.route !== "/")
    .map((screen) => {
      const pagePath = screenRoutePagePath(screen);
      const contents = files[pagePath] || "";
      const rendered = Boolean(contents);
      const renderer = implementationScreenIds.has(screen.id)
        ? "implementation"
        : rendered
          ? "generator"
          : "missing";
      if (!rendered) {
        diagnostics.push({
          code: "screen_route_not_rendered",
          severity: "error",
          screen: screen.id,
          route: screen.route,
          message: `Screen '${screen.id}' has route '${screen.route}' but no SvelteKit page was generated.`,
          suggested_fix: "Check the SvelteKit generator contract-complete route emission for this screen."
        });
      }
      const componentUsages = screenComponentUsages(screen).map((usage) => {
        const componentId = usage.component?.id || null;
        const marker = componentId ? `data-topogram-component="${componentId}"` : null;
        const support = svelteKitComponentUsageSupport(usage, contract.components);
        const usageRendered = Boolean(marker && contents.includes(marker));
        if (componentId && rendered && renderer !== "implementation" && !support.supported) {
          diagnostics.push({
            code: "component_pattern_not_supported",
            severity: "error",
            screen: screen.id,
            route: screen.route,
            region: usage.region || null,
            pattern: support.pattern || null,
            component: componentId,
            message: `Screen '${screen.id}' uses component '${componentId}' with unsupported SvelteKit component pattern '${support.pattern || "(missing)"}'.`,
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
            message: `Screen '${screen.id}' uses component '${componentId}' but the generated SvelteKit page does not contain its component marker.`,
            suggested_fix: "Render the component region with renderSvelteKitComponentRegion or add a supported component pattern."
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
        renderer,
        component_usages: componentUsages
      };
    });

  return {
    type: "generation_coverage",
    surface: "web",
    generator: "topogram/sveltekit",
    projection: {
      id: contract.projection.id,
      name: contract.projection.name,
      platform: contract.projection.platform
    },
    summary: {
      routed_screens: screens.length,
      rendered_screens: screens.filter((screen) => screen.rendered).length,
      implementation_screens: screens.filter((screen) => screen.renderer === "implementation").length,
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
  throw new Error(`SvelteKit generation coverage failed: ${details}`);
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

function buildSvelteVisibilityModule() {
  return renderVisibilityModule("sveltekit");
}

function buildSvelteKitClientModule(webReference, defaultApiBaseUrl) {
  return renderApiClientModule("sveltekit", { ...webReference, defaultApiBaseUrl }, { supportsDownload: true });
}

function buildSvelteKitLookupModule(defaultApiBaseUrl) {
  return renderLookupModule("sveltekit", defaultApiBaseUrl);
}

function buildSvelteKitScaffold(contract, apiContracts, options = {}) {
  const implementation = getExampleImplementation(null, options);
  const webReference = implementation.web.reference;
  const runtimeReference = implementation.runtime.reference;
  const webScreenReference = implementation.web.screenReference;
  const webRenderers = implementation.web.renderers;
  const profile = contract.generatorDefaults.profile || "sveltekit";
  const language = contract.generatorDefaults.language || "typescript";
  const useTypescript = language === "typescript";
  const files = {};

  const brandName = contract.appShell?.brand || webReference.brandName;
  const navLinks = resolveNavLinks(contract, webReference);
  const footerEnabled = contract.appShell?.footer && contract.appShell.footer !== "none";
  const shellMode = contract.appShell?.shell || "topbar";
  const windowingMode = contract.appShell?.windowing || "single_window";
  const navigationPatterns = (contract.navigation?.patterns || []).join(" ");
  const hasCommandPalette = (contract.navigation?.patterns || []).includes("command_palette");
  const homeDescription = webReference.home.heroDescriptionTemplate.replace("PROFILE", `\`${profile}\``);
  const demoPrimaryEnvVar = webReference.home.demoPrimaryEnvVar;
  const ownerEnvVar = webReference.createPrimary.defaultOwnerEnvVar || webReference.createPrimary.defaultAssigneeEnvVar;
  const containerEnvVar = webReference.createPrimary.defaultContainerEnvVar;
  files["package.json"] = JSON.stringify(
    {
      name: contract.projection.id,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite dev",
        build: "vite build",
        preview: "vite preview",
        check: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
      },
      devDependencies: {
        "@sveltejs/adapter-auto": "^3.0.0",
        "@sveltejs/kit": "^2.0.0",
        "@types/node": "^22.10.2",
        "svelte-check": "^4.0.0",
        svelte: "^5.0.0",
        typescript: "^5.6.3",
        vite: "^8.0.0"
      }
    },
    null,
    2
  ) + "\n";
  files["svelte.config.js"] = `import adapter from "@sveltejs/adapter-auto";\n\nexport default {\n  kit: {\n    adapter: adapter()\n  }\n};\n`;
  files["tsconfig.json"] = JSON.stringify(
    {
      extends: "./.svelte-kit/tsconfig.json",
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: "Bundler",
        resolveJsonModule: true,
        skipLibCheck: true,
        sourceMap: true,
        strict: true
      }
    },
    null,
    2
  ) + "\n";
  files["vite.config.ts"] = `import { sveltekit } from "@sveltejs/kit/vite";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [sveltekit()]\n});\n`;
  files["src/app.html"] =
    "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    %sveltekit.head%\n  </head>\n  <body data-sveltekit-preload-data=\"hover\">\n    <div style=\"display: contents\">%sveltekit.body%</div>\n  </body>\n</html>\n";
  files["src/app.css"] =
    `${renderDesignIntentCss(contract.design)}\n` +
    ":root {\n  font-family: system-ui, sans-serif;\n  color: var(--topogram-text-color);\n  background: var(--topogram-surface-background);\n}\nbody {\n  margin: 0;\n}\na {\n  color: var(--topogram-action-primary-background);\n  text-decoration: none;\n}\na:hover {\n  text-decoration: underline;\n}\nmain {\n  max-width: 72rem;\n  margin: 0 auto;\n  padding: var(--topogram-page-padding);\n}\n.app-shell {\n  min-height: 100vh;\n}\n.app-workspace {\n  display: grid;\n  grid-template-columns: 18rem minmax(0, 1fr);\n  min-height: 100vh;\n}\n.app-main-shell {\n  min-width: 0;\n}\n.app-sidebar {\n  position: sticky;\n  top: 0;\n  align-self: start;\n  min-height: 100vh;\n  display: grid;\n  align-content: start;\n  gap: var(--topogram-space-unit);\n  padding: 1.25rem 1rem;\n  border-right: 1px solid rgba(24, 32, 38, 0.08);\n  background: rgba(255, 255, 255, 0.86);\n  backdrop-filter: blur(12px);\n}\n.app-nav {\n  position: sticky;\n  top: 0;\n  z-index: 10;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: var(--topogram-space-unit);\n  padding: 1rem 1.25rem;\n  border-bottom: 1px solid rgba(24, 32, 38, 0.08);\n  background: rgba(255, 255, 255, 0.9);\n  backdrop-filter: blur(12px);\n}\n.app-nav-links,\n.app-nav nav,\n.app-tabbar {\n  display: flex;\n  gap: 0.75rem;\n  flex-wrap: wrap;\n}\n.app-nav.menu-bar {\n  border-bottom-style: dashed;\n}\n.app-nav.compact {\n  justify-content: flex-end;\n}\n.app-tabbar {\n  position: sticky;\n  bottom: 0;\n  z-index: 10;\n  justify-content: space-around;\n  padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));\n  border-top: 1px solid rgba(24, 32, 38, 0.08);\n  background: rgba(255, 255, 255, 0.92);\n  backdrop-filter: blur(12px);\n}\n.brand {\n  font-weight: 700;\n  letter-spacing: 0.01em;\n}\n.brand-mark {\n  font-weight: 700;\n  color: var(--topogram-muted-color);\n}\n.command-palette-button {\n  background: var(--topogram-text-color);\n  color: white;\n  border: none;\n  border-radius: var(--topogram-radius-pill);\n  padding: var(--topogram-control-padding);\n  font: inherit;\n  cursor: pointer;\n}\n.app-footer {\n  max-width: 72rem;\n  margin: 0 auto;\n  padding: 0 1.25rem 2rem;\n  color: var(--topogram-muted-color);\n}\n.card {\n  background: var(--topogram-surface-card);\n  border-radius: var(--topogram-radius-card);\n  padding: 1.25rem;\n  box-shadow: 0 12px 30px rgba(24, 32, 38, 0.08);\n}\n.hero {\n  display: grid;\n  gap: var(--topogram-space-unit);\n}\n.grid {\n  display: grid;\n  gap: var(--topogram-space-unit);\n}\n.grid.two {\n  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));\n}\n.filters {\n  display: grid;\n  gap: 0.75rem;\n  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));\n  margin: 1rem 0 1.25rem;\n}\nlabel {\n  display: grid;\n  gap: 0.35rem;\n  font-size: 0.95rem;\n}\ninput,\ntextarea,\nbutton,\nselect {\n  font: inherit;\n}\ninput,\ntextarea,\nselect {\n  width: 100%;\n  box-sizing: border-box;\n  border: 1px solid #c9d4e2;\n  border-radius: var(--topogram-radius-control);\n  padding: var(--topogram-control-padding);\n  background: white;\n}\ntextarea {\n  min-height: 8rem;\n  resize: vertical;\n}\nbutton,\n.button-link {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 0.35rem;\n  border: none;\n  border-radius: var(--topogram-radius-pill);\n  padding: var(--topogram-control-padding);\n  background: var(--topogram-action-primary-background);\n  color: var(--topogram-action-primary-color);\n  font-weight: 600;\n  cursor: pointer;\n}\nbutton:focus-visible,\n.button-link:focus-visible,\na:focus-visible,\ninput:focus-visible,\ntextarea:focus-visible,\nselect:focus-visible {\n  outline: var(--topogram-focus-outline);\n  outline-offset: 2px;\n}\n.button-link.secondary {\n  background: #e9eef6;\n  color: var(--topogram-text-color);\n}\n.button-row {\n  display: flex;\n  gap: 0.75rem;\n  flex-wrap: wrap;\n  align-items: center;\n}\n.stack {\n  display: grid;\n  gap: var(--topogram-space-unit);\n}\n\n.resource-list {\n  list-style: none;\n  padding: 0;\n  margin: 1rem 0 0;\n  display: grid;\n  gap: 0.75rem;\n}\n\n.resource-list li {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: var(--topogram-space-unit);\n  padding: 1rem;\n  border: 1px solid #e0e8f1;\n  border-radius: var(--topogram-radius-card);\n  background: var(--topogram-surface-subtle);\n}\n.table-wrap {\n  margin-top: 1rem;\n  overflow-x: auto;\n  border: 1px solid var(--topogram-border-color);\n  border-radius: var(--topogram-radius-card);\n  background: white;\n}\n.resource-table {\n  width: 100%;\n  border-collapse: collapse;\n  min-width: 42rem;\n}\n.resource-table th,\n.resource-table td {\n  padding: 0.85rem 1rem;\n  text-align: left;\n  border-bottom: 1px solid #e7edf5;\n  vertical-align: top;\n}\n.resource-table th {\n  font-size: 0.85rem;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: #516173;\n  background: #f8fbff;\n}\n.resource-table tbody tr:hover {\n  background: #fbfdff;\n}\n.data-grid {\n  min-width: 64rem;\n  font-size: 0.95rem;\n}\n.data-grid thead th {\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  background: #eef5ff;\n}\n.data-grid-shell {\n  box-shadow: inset 0 0 0 1px rgba(15, 92, 192, 0.04);\n}\n.cell-stack,\n.resource-meta,\n.definition-list {\n  display: grid;\n  gap: 0.5rem;\n}\n.cell-secondary {\n  color: var(--topogram-muted-color);\n  font-size: 0.92rem;\n}\n.definition-list {\n  grid-template-columns: minmax(8rem, 12rem) 1fr;\n  align-items: start;\n}\n.definition-list dt {\n  font-weight: 600;\n  color: #516173;\n}\n.definition-list dd {\n  margin: 0;\n}\n.badge {\n  display: inline-flex;\n  align-items: center;\n  padding: 0.25rem 0.6rem;\n  border-radius: var(--topogram-radius-pill);\n  background: #eef4ff;\n  color: var(--topogram-action-primary-background);\n  font-size: 0.85rem;\n  font-weight: 600;\n}\n.muted {\n  color: var(--topogram-muted-color);\n}\n.empty-state {\n  padding: 1rem 0;\n}\n.component-card {\n  border: 1px solid var(--topogram-border-color);\n  border-radius: var(--topogram-radius-card);\n  background: var(--topogram-surface-subtle);\n  padding: 1rem;\n  margin-top: 1rem;\n}\n.component-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: var(--topogram-space-unit);\n  flex-wrap: wrap;\n}\n.component-eyebrow {\n  margin: 0 0 0.25rem;\n  color: var(--topogram-muted-color);\n  font-size: 0.75rem;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n.component-card h2,\n.component-card h3 {\n  margin: 0;\n}\n.component-table-wrap {\n  margin-top: 1rem;\n}\n.summary-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));\n  gap: 0.75rem;\n}\n.summary-grid div,\n.board-column {\n  border: 1px solid #e0e8f1;\n  border-radius: var(--topogram-radius-control);\n  background: white;\n  padding: 0.85rem;\n}\n.summary-grid strong {\n  display: block;\n  font-size: 1.5rem;\n}\n.summary-grid span,\n.calendar-list span {\n  color: var(--topogram-muted-color);\n  font-size: 0.9rem;\n}\n.board-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));\n  gap: 0.75rem;\n  margin-top: 1rem;\n}\n.board-card,\n.calendar-card {\n  display: grid;\n  gap: 0.25rem;\n  border: 1px solid #e0e8f1;\n  border-radius: var(--topogram-radius-control);\n  background: #f8fbff;\n  padding: 0.75rem;\n}\n.calendar-list {\n  display: grid;\n  gap: 0.75rem;\n  margin-top: 1rem;\n}\nsmall.route-hint {\n  display: block;\n  color: var(--topogram-muted-color);\n  margin-top: 0.25rem;\n}\n@media (max-width: 900px) {\n  .app-workspace {\n    grid-template-columns: 1fr;\n  }\n  .app-sidebar {\n    position: static;\n    min-height: auto;\n    border-right: none;\n    border-bottom: 1px solid rgba(24, 32, 38, 0.08);\n  }\n}\n@media (max-width: 640px) {\n  .definition-list {\n    grid-template-columns: 1fr;\n  }\n  .resource-list li {\n    flex-direction: column;\n  }\n  .resource-table {\n    min-width: 36rem;\n  }\n  .app-nav {\n    flex-wrap: wrap;\n  }\n}\n";
  const navMarkup = navLinks.map((link) => `      <a href="${link.route}">${link.label}</a>`).join("\n");
  const shellLayout =
    shellMode === "split_view"
      ? `<div class="app-workspace">\n  <aside class="app-sidebar">\n    <a class="brand" href="/">${brandName}</a>\n    <nav class="app-nav-links">\n${navMarkup}\n    </nav>\n${hasCommandPalette ? `    <button class="command-palette-button" type="button">Command Palette</button>\n` : ""}  </aside>\n  <div class="app-main-shell">\n    <header class="app-nav compact">\n      <div class="brand-mark">${brandName}</div>\n${hasCommandPalette ? `      <button class="command-palette-button" type="button">Command Palette</button>\n` : ""}    </header>\n\n    <slot />\n  </div>\n</div>`
      : shellMode === "bottom_tabs"
        ? `<header class="app-nav">\n  <a class="brand" href="/">${brandName}</a>\n${hasCommandPalette ? `  <button class="command-palette-button" type="button">Command Palette</button>\n` : ""}</header>\n\n<slot />\n\n<nav class="app-tabbar">\n${navMarkup}\n</nav>`
        : `<header class="app-nav${shellMode === "menu_bar" ? " menu-bar" : ""}">\n  <a class="brand" href="/">${brandName}</a>\n  <nav class="app-nav-links">\n${navMarkup}\n  </nav>\n${hasCommandPalette ? `  <button class="command-palette-button" type="button">Command Palette</button>\n` : ""}</header>\n\n<slot />`;
  files["src/routes/+layout.svelte"] = `<script${useTypescript ? ' lang="ts"' : ""}>\n  import "../app.css";\n</script>\n\n<div class="app-shell" data-shell="${shellMode}" data-windowing="${windowingMode}" data-navigation-patterns="${navigationPatterns}">\n  ${shellLayout}\n${footerEnabled ? `\n  <footer class="app-footer">\n    <span>Generated from Topogram</span>\n  </footer>` : ""}\n</div>\n`;
  files["src/routes/+page.svelte"] = webRenderers.renderHomePage({
    useTypescript,
    demoPrimaryEnvVar,
    screens: contract.screens.map((screen) => ({
      id: screen.id,
      title: screen.title || screen.id,
      route: screen.route,
      navigable: Boolean(screen.route) && !screen.route.includes(":")
    })),
    projectionName: contract.projection.name,
    homeDescription,
    webReference
  });
  files["src/lib/topogram/api-contracts.json"] = `${JSON.stringify(apiContracts, null, 2)}\n`;
  files["src/lib/auth/visibility.ts"] = buildSvelteVisibilityModule();
  files["src/lib/api/client.ts"] = buildSvelteKitClientModule(webReference, `http://localhost:${runtimeReference?.ports?.server || 3000}`);
  files["src/lib/api/lookups.ts"] = buildSvelteKitLookupModule(`http://localhost:${runtimeReference?.ports?.server || 3000}`);

  for (const screen of contract.screens || []) {
    if (!screen.route || screen.route === "/") continue;
    Object.assign(files, buildGenericSvelteKitScreenFiles(screen, contract, useTypescript));
  }

  const primaryList = contract.screens.find((screen) => screen.id === webScreenReference.listScreenId);
  const primaryDetail = contract.screens.find((screen) => screen.id === webScreenReference.detailScreenId);
  const primaryCreate = contract.screens.find((screen) => screen.id === webScreenReference.createScreenId);
  const primaryEdit = contract.screens.find((screen) => screen.id === webScreenReference.editScreenId);
  const primaryExports = webScreenReference.exportsScreenId
    ? contract.screens.find((screen) => screen.id === webScreenReference.exportsScreenId)
    : null;
  const primaryListLookups = Object.fromEntries((primaryList?.lookups || []).map((lookup) => [lookup.field, lookupDescriptor(lookup)]));
  const primaryCreateLookups = Object.fromEntries((primaryCreate?.lookups || []).map((lookup) => [lookup.field, lookupDescriptor(lookup)]));
  const primaryEditLookups = Object.fromEntries((primaryEdit?.lookups || []).map((lookup) => [lookup.field, lookupDescriptor(lookup)]));
  const routePageScreenIds = new Map(
    (contract.screens || [])
      .filter((screen) => screen.route && screen.route !== "/")
      .map((screen) => [screenRoutePagePath(screen), screen.id])
  );
  const implementationScreenIds = new Set();

  if (primaryList?.route && primaryDetail?.route && primaryCreate?.route && primaryEdit?.route) {
    for (const [relativePath, contents] of Object.entries(webRenderers.renderRoutes({
      useTypescript,
      contract,
      primaryList,
      primaryDetail,
      primaryCreate,
      primaryEdit,
      primaryExports,
      primaryListLookups,
      primaryCreateLookups,
      primaryEditLookups,
      containerEnvVar,
      ownerEnvVar,
      webReference,
      prettyScreenKind
    }))) {
      const filePath = `src/routes/${relativePath}`;
      files[filePath] = contents;
      const screenId = routePageScreenIds.get(filePath);
      if (screenId) implementationScreenIds.add(screenId);
    }
  }

  const coverage = buildSvelteKitGenerationCoverage(contract, files, implementationScreenIds);
  assertGenerationCoverage(coverage);
  files["src/lib/topogram/generation-coverage.json"] = `${JSON.stringify(coverage, null, 2)}\n`;
  files["src/lib/topogram/ui-web-contract.json"] = `${JSON.stringify(contract, null, 2)}\n`;
  return files;
}

export function generateSvelteKitApp(graph, options = {}) {
  const realization = buildWebRealization(graph, options);
  return buildSvelteKitScaffold(realization.contract, realization.apiContracts, options);
}
