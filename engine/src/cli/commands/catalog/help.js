// @ts-check

/**
 * @returns {void}
 */
export function printCatalogHelp() {
  console.log("Usage: topogram catalog list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog doctor [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog check <path-or-url> [--json]");
  console.log("   or: topogram catalog copy <id> <target> [--version <version>] [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Catalog commands inspect the shared Topogram index. The catalog is an index; templates and topograms resolve to versioned packages.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram catalog list");
  console.log("  topogram catalog show hello-web");
  console.log("  topogram catalog doctor");
  console.log("  topogram catalog check topograms.catalog.json");
  console.log("  topogram catalog copy hello ./hello-topogram");
}
