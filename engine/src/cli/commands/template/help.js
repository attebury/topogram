// @ts-check

/**
 * @returns {void}
 */
export function printTemplateHelp() {
  console.log("Usage: topogram template list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram template explain [path] [--json]");
  console.log("   or: topogram template status [path] [--latest] [--json]");
  console.log("   or: topogram template detach [path] [--dry-run] [--remove-policy] [--json]");
  console.log("   or: topogram template check <template-spec-or-path> [--json]");
  console.log("   or: topogram template policy init [path] [--json]");
  console.log("   or: topogram template policy check [path] [--json]");
  console.log("   or: topogram template policy explain [path] [--json]");
  console.log("   or: topogram template policy pin <template-id@version> [path] [--json]");
  console.log("   or: topogram template update [path] --status|--recommend|--plan|--check|--apply [--template <spec>|--latest] [--json] [--out <path>]");
  console.log("");
  console.log("Template commands inspect catalog-backed starters, project provenance, trust policy, and update plans.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram template list");
  console.log("  topogram template explain");
  console.log("  topogram template status");
  console.log("  topogram template status --latest");
  console.log("  topogram template policy check");
  console.log("  topogram template check ./local-template");
  console.log("  topogram template update --recommend");
}
