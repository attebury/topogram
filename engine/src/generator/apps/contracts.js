import { refList, symbolList } from "../shared.js";
import { buildUiSharedRealization } from "../../realization/ui/index.js";

export function generateUiContractGraph(graph, options = {}) {
  return buildUiSharedRealization(graph, options);
}

export function generateUiContractDebug(graph, options = {}) {
  const contracts = options.projectionId ? [generateUiContractGraph(graph, options)] : Object.values(generateUiContractGraph(graph, options));
  const lines = [];

  lines.push("# UI Contract Debug");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  for (const contract of contracts) {
    lines.push(`## \`${contract.projection.id}\` - ${contract.projection.name}`);
    lines.push("");
    lines.push(`Platform: \`${contract.projection.platform}\``);
    lines.push(`Realizes: ${refList(contract.realizes)}`);
    lines.push(`Outputs: ${symbolList(contract.outputs)}`);
    if (contract.appShell) {
      lines.push(`App shell: brand \`${contract.appShell.brand}\`, shell \`${contract.appShell.shell}\``);
    }
    if (contract.navigation) {
      const visibleItems = (contract.navigation.items || []).filter((item) => item.visible);
      lines.push(`Navigation: ${visibleItems.length > 0 ? visibleItems.map((item) => `\`${item.label}\``).join(", ") : "_none_"}`);
    }
    lines.push("");

    for (const screen of contract.screens) {
      lines.push(`### \`${screen.id}\` - ${screen.title || screen.id}`);
      lines.push("");
      lines.push(`Kind: \`${screen.kind}\``);
      if (screen.loadCapability?.id) {
        lines.push(`Load: \`${screen.loadCapability.id}\``);
      }
      if (screen.submitCapability?.id) {
        lines.push(`Submit: \`${screen.submitCapability.id}\``);
      }
      if (screen.viewShape?.id) {
        lines.push(`View shape: \`${screen.viewShape.id}\``);
      }
      if (screen.itemShape?.id) {
        lines.push(`Item shape: \`${screen.itemShape.id}\``);
      }
      if (screen.inputShape?.id) {
        lines.push(`Input shape: \`${screen.inputShape.id}\``);
      }
      if (screen.navigation.successNavigate) {
        lines.push(`Success navigate: \`${screen.navigation.successNavigate}\``);
      }
      if (screen.navigation.successRefresh) {
        lines.push(`Success refresh: \`${screen.navigation.successRefresh}\``);
      }
      if (screen.emptyState) {
        lines.push(`Empty state: \`${screen.emptyState.title || ""}\` ${screen.emptyState.body ? `- ${screen.emptyState.body}` : ""}`.trim());
      }
      lines.push(
        `States: ${Object.entries(screen.states || {})
          .map(([key, value]) => `\`${key}=${value}\``)
          .join(", ")}`
      );
      if ((screen.patterns || []).length > 0) {
        lines.push(`Patterns: ${(screen.patterns || []).map((pattern) => `\`${pattern}\``).join(", ")}`);
      }
      lines.push("");

      lines.push("Actions:");
      if (
        !screen.actions.primary?.id &&
        !screen.actions.secondary?.id &&
        !screen.actions.destructive?.id &&
        !screen.actions.terminal?.id &&
        screen.actions.screen.length === 0
      ) {
        lines.push("- _none_");
      } else {
        for (const [label, action] of [
          ["primary", screen.actions.primary],
          ["secondary", screen.actions.secondary],
          ["destructive", screen.actions.destructive],
          ["terminal", screen.actions.terminal]
        ]) {
          if (action?.id) {
            lines.push(`- ${label}: \`${action.id}\``);
          }
        }
        for (const action of screen.actions.screen) {
          lines.push(`- screen action: \`${action.capability?.id}\` (${action.prominence})`);
        }
      }
      lines.push("");

      lines.push("Collection:");
      lines.push(`- filters: ${screen.collection.filters.length > 0 ? screen.collection.filters.map((field) => `\`${field}\``).join(", ") : "_none_"}`);
      lines.push(`- search: ${screen.collection.search.length > 0 ? screen.collection.search.map((field) => `\`${field}\``).join(", ") : "_none_"}`);
      lines.push(`- pagination: ${screen.collection.pagination ? `\`${screen.collection.pagination}\`` : "_none_"}`);
      lines.push(`- views: ${screen.collection.views.length > 0 ? screen.collection.views.map((view) => `\`${view}\``).join(", ") : "_none_"}`);
      lines.push(`- groupBy: ${screen.collection.groupBy.length > 0 ? screen.collection.groupBy.map((field) => `\`${field}\``).join(", ") : "_none_"}`);
      lines.push(
        `- sort: ${
          screen.collection.sort.length > 0
            ? screen.collection.sort.map((entry) => `\`${entry.field}\` ${entry.direction}`).join(", ")
            : "_none_"
        }`
      );
      lines.push("");

      lines.push("Visibility:");
      if (screen.visibility.length === 0) {
        lines.push("- _none_");
      } else {
        for (const rule of screen.visibility) {
          lines.push(`- \`${rule.capability?.id}\` visible_if ${rule.predicate} \`${rule.value}\`${rule.claimValue ? ` claim_value \`${rule.claimValue}\`` : ""}${rule.ownershipField ? ` ownership_field \`${rule.ownershipField}\`` : ""}`);
        }
      }
      lines.push("");

      lines.push("Lookups:");
      if (screen.lookups.length === 0) {
        lines.push("- _none_");
      } else {
        for (const lookup of screen.lookups) {
          lines.push(
            `- field \`${lookup.field}\` -> entity \`${lookup.entity?.id}\` label_field \`${lookup.labelField}\`${lookup.emptyLabel ? ` empty_label "${lookup.emptyLabel}"` : ""}`
          );
        }
      }
      lines.push("");

      lines.push("Regions:");
      if (screen.regions.length === 0) {
        lines.push("- _none_");
      } else {
        for (const region of screen.regions) {
          lines.push(`- \`${region.region}\`${region.pattern ? ` pattern \`${region.pattern}\`` : ""}${region.placement ? ` placement \`${region.placement}\`` : ""}`);
        }
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
