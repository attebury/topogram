import { buildWebRealization } from "../../../realization/ui/index.js";

export function generateUiWebContract(graph, options = {}) {
  if (!options.projectionId) {
    const output = {};
    for (const projection of (graph.byKind.projection || []).filter((entry) => entry.platform === "ui_web")) {
      output[projection.id] = buildWebRealization(graph, { ...options, projectionId: projection.id }).contract;
    }
    return output;
  }

  return buildWebRealization(graph, options).contract;
}

export function generateUiWebDebug(graph, options = {}) {
  const contracts = options.projectionId ? [generateUiWebContract(graph, options)] : Object.values(generateUiWebContract(graph, options));
  const lines = [];

  lines.push("# UI Web Debug");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  for (const contract of contracts) {
    lines.push(`## \`${contract.projection.id}\` - ${contract.projection.name}`);
    lines.push("");
    if (contract.sharedProjection?.id) {
      lines.push(`Shared projection: \`${contract.sharedProjection.id}\``);
    }
    lines.push(
      `Generator defaults: ${
        Object.keys(contract.generatorDefaults).length > 0
          ? Object.entries(contract.generatorDefaults).map(([key, value]) => `\`${key}=${value}\``).join(", ")
          : "_none_"
      }`
    );
    if (contract.appShell) {
      lines.push(`App shell: \`${contract.appShell.shell}\` brand \`${contract.appShell.brand}\``);
    }
    if (contract.navigation) {
      const visibleItems = (contract.navigation.items || []).filter((item) => item.visible);
      lines.push(`Navigation: ${visibleItems.length > 0 ? visibleItems.map((item) => `\`${item.label}\``).join(", ") : "_none_"}`);
    }
    lines.push("");

    for (const screen of contract.screens) {
      lines.push(`### \`${screen.id}\``);
      lines.push("");
      lines.push(`Route: ${screen.route ? `\`${screen.route}\`` : "_none_"}`);
      lines.push(`Layout hints: ${Object.keys(screen.web).length > 0 ? Object.entries(screen.web).map(([key, value]) => `\`${key}=${value}\``).join(", ") : "_none_"}`);
      lines.push("");
    }

    if ((contract.sitemap || []).length > 0) {
      lines.push("### Sitemap");
      lines.push("");
      for (const entry of contract.sitemap) {
        lines.push(`- ${entry.include ? "include" : "exclude"} \`${entry.route}\` (${entry.label})`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
