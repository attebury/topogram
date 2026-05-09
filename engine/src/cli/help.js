// @ts-check

/**
 * @param {{ all?: boolean }} [options]
 * @returns {void}
 */
export function printUsage(options = {}) {
  const { all = false } = options;
  console.log("Usage: topogram version [--json]");
  console.log("Usage: topogram doctor [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram doctor --allow-local-npmrc");
  console.log("Usage: topogram setup package-auth|catalog-auth");
  console.log("Usage: topogram release status [--json] [--strict] [--markdown|--write-report <path>]");
  console.log("   or: topogram release roll-consumers <version|--latest> [--json] [--no-push] [--watch]");
  console.log("Usage: topogram check [path] [--json]");
  console.log("   or: topogram widget check [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram widget behavior [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram agent brief [path] [--json]");
  console.log("   or: topogram generate [path] [--out <path>]");
  console.log("   or: topogram emit <target> [path] [--json|--write --out-dir <path>]");
  console.log("   or: topogram query list [--json]");
  console.log("   or: topogram query show <name> [--json]");
  console.log("   or: topogram trust template [path]");
  console.log("   or: topogram trust status [path] [--json]");
  console.log("   or: topogram trust diff [path] [--json]");
  console.log("   or: topogram catalog list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog doctor [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog check <path-or-url> [--json]");
  console.log("   or: topogram catalog copy <id> <target> [--version <version>] [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram package update-cli <version|--latest> [--json]");
  console.log("   or: topogram import <app-path> --out <target> [--from <track[,track]>] [--json]");
  console.log("   or: topogram import refresh [path] [--from <app-path>] [--dry-run] [--json]");
  console.log("   or: topogram import diff [path] [--json]");
  console.log("   or: topogram import check [path] [--json]");
  console.log("   or: topogram import plan [path] [--json]");
  console.log("   or: topogram import adopt --list [path] [--json]");
  console.log("   or: topogram import adopt <selector> [path] [--dry-run|--write] [--force --reason <text>] [--json]");
  console.log("   or: topogram import status [path] [--json]");
  console.log("   or: topogram import history [path] [--verify] [--json]");
  console.log("   or: topogram source status [path] [--local|--remote] [--json]");
  console.log("   or: topogram template list [--json]");
  console.log("   or: topogram template explain [path] [--json]");
  console.log("   or: topogram template status [path] [--latest] [--json]");
  console.log("   or: topogram template detach [path] [--dry-run] [--remove-policy] [--json]");
  console.log("   or: topogram template policy init [path] [--json]");
  console.log("   or: topogram template policy check [path] [--json]");
  console.log("   or: topogram template policy explain [path] [--json]");
  console.log("   or: topogram template policy pin [template-id@version] [path] [--json]");
  console.log("   or: topogram template check <template-spec-or-path> [--json]");
  console.log("   or: topogram template update [path] --status|--recommend|--plan|--check|--apply [--template <spec>|--latest] [--json] [--out <path>]");
  console.log("   or: topogram template update [path] --accept-current|--accept-candidate|--delete-current <file> [--template <spec>] [--json]");
  console.log("   or: topogram generator list [--json]");
  console.log("   or: topogram generator show <id-or-package> [--json]");
  console.log("   or: topogram generator check <path-or-package> [--json]");
  console.log("   or: topogram generator policy init [path] [--json]");
  console.log("   or: topogram generator policy status [path] [--json]");
  console.log("   or: topogram generator policy check [path] [--json]");
  console.log("   or: topogram generator policy explain [path] [--json]");
  console.log("   or: topogram generator policy pin [package@version] [path] [--json]");
  console.log("   or: topogram new <path> [--template hello-web|todo|./local-template|@scope/template]");
  console.log("   or: topogram new <path> --template <package> --allow-local-npmrc");
  console.log("   or: topogram new --list-templates [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Common commands:");
  console.log("  topogram version");
  console.log("  topogram doctor");
  console.log("  topogram setup package-auth");
  console.log("  topogram release status");
  console.log("  topogram release roll-consumers --latest");
  console.log("  topogram new ./my-app");
  console.log("  topogram new --list-templates");
  console.log("  topogram new ./my-app --template todo");
  console.log("  topogram check");
  console.log("  topogram check --json");
  console.log("  topogram widget check --projection proj_web_surface");
  console.log("  topogram widget behavior --projection proj_web_surface");
  console.log("  topogram agent brief");
  console.log("  topogram agent brief --json");
  console.log("  topogram query list");
  console.log("  topogram query show widget-behavior");
  console.log("  topogram query widget-behavior ./topogram --projection proj_web_surface --json");
  console.log("  topogram emit ui-widget-contract --widget widget_data_grid --json");
  console.log("  topogram emit widget-conformance-report ./topogram --projection proj_web_surface --json");
  console.log("  topogram generator list");
  console.log("  topogram generator show @topogram/generator-react-web");
  console.log("  topogram generator check ./generator-package");
  console.log("  topogram generator policy check");
  console.log("  topogram generate");
  console.log("  topogram import ./existing-app --out ./imported-topogram");
  console.log("  topogram import diff ./imported-topogram");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app --dry-run");
  console.log("  topogram import check ./imported-topogram");
  console.log("  topogram import plan ./imported-topogram");
  console.log("  topogram import adopt --list ./imported-topogram");
  console.log("  topogram import adopt bundle:task ./imported-topogram --dry-run");
  console.log("  topogram import status ./imported-topogram");
  console.log("  topogram import history ./imported-topogram --verify");
  console.log("");
  console.log("Fresh install:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("  npx topogram doctor");
  console.log("  npx topogram template list");
  console.log("  npx topogram new ./my-app --template hello-web");
  console.log("  cd ./my-app && npm install && npm run check && npm run generate");
  console.log("  npm --prefix app run compile");
  console.log("");
  console.log("Template and catalog discovery:");
  console.log("  topogram template list");
  console.log("  topogram catalog list");
  console.log("  topogram catalog show todo");
  console.log("  topogram catalog doctor");
  console.log("  topogram catalog check topograms.catalog.json");
  console.log("  topogram catalog copy hello ./hello-topogram");
  console.log("  topogram source status --local");
  console.log("  topogram source status --remote");
  console.log("");
  console.log("Template trust and updates:");
  console.log("  topogram trust template");
  console.log("  topogram trust status");
  console.log("  topogram trust diff");
  console.log("  topogram package update-cli --latest");
  console.log("  topogram template explain");
  console.log("  topogram template status");
  console.log("  topogram template status --latest");
  console.log("  topogram template detach");
  console.log("  topogram template policy init");
  console.log("  topogram template policy check");
  console.log("  topogram template policy explain");
  console.log("  topogram template policy pin @scope/template@0.2.0");
  console.log("  topogram template check ./local-template");
  console.log("  topogram template update --status");
  console.log("  topogram template update --recommend");
  console.log("  topogram template update --recommend --latest");
  console.log("  topogram template update --plan");
  console.log("  topogram template update --check");
  console.log("  topogram template update --apply");
  console.log("");
  console.log("Defaults: check/generate use ./topogram, and generate writes ./app.");
  console.log("Default starter: hello-web from the catalog. Run `topogram template list` for catalog aliases.");
  console.log("Generated app commands are emitted into the output package.json.");
  console.log("Run `topogram help <command>` for command-specific help.");
  console.log("Run `topogram help all` for legacy and agent-facing commands.");
  if (!all) {
    return;
  }
  console.log("");
  console.log("Legacy and internal commands:");
  console.log("Usage: topogram create <path> [--template hello-web|todo|./local-template|@scope/template]");
  console.log("   or: topogram template show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram import app <path> [--from <track[,track]>] [--write]");
  console.log("   or: topogram validate <path>");
  console.log("   or: node ./src/cli.js query work-packet <path> --mode import-adopt --lane <id>");
  console.log("   or: node ./src/cli.js <path> [--json] [--validate] [--resolve] [--workflow <name>] [--mode <id>] [--from <track[,track]>] [--adopt <selector>] [--refresh-adopted] [--shape <id>] [--capability <id>] [--widget <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--task <id>] [--profile <id>] [--from-snapshot <path>] [--from-topogram <path>] [--write] [--out-dir <path>]");
  console.log("   or: node ./src/cli.js emit <target> [path] [--json] [--write] [--out-dir <path>]");
  console.log("   or: node ./src/cli.js import app <path> [--from <track[,track]>] [--write]");
  console.log("   or: node ./src/cli.js import docs <path> [--write]");
  console.log("   or: node ./src/cli.js generate journeys <path> [--write]");
  console.log("   or: node ./src/cli.js report gaps <path> [--write]");
  console.log("   or: node ./src/cli.js query task-mode <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query adoption-plan <path>");
  console.log("   or: node ./src/cli.js query maintained-boundary <path>");
  console.log("   or: node ./src/cli.js query maintained-conformance <path> [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query maintained-drift <path> --from-topogram <path>");
  console.log("   or: node ./src/cli.js query seam-check <path> [--seam <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query diff <path> --from-topogram <path>");
  console.log("   or: node ./src/cli.js query slice <path> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--domain <id>]");
  console.log("   or: node ./src/cli.js query domain-list <path>");
  console.log("   or: node ./src/cli.js query domain-coverage <path> --domain <id>");
  console.log("   or: node ./src/cli.js query review-boundary <path> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>]");
  console.log("   or: node ./src/cli.js query write-scope <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query verification-targets <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query widget-behavior <path> [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: node ./src/cli.js query change-plan <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query import-plan <path>");
  console.log("   or: node ./src/cli.js query risk-summary <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query canonical-writes <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query proceed-decision <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query review-packet <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query next-action <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query single-agent-plan <path> --mode <id> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query multi-agent-plan <path> --mode import-adopt");
  console.log("   or: node ./src/cli.js query resolved-workflow-context <path> --mode <id> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--provider <id>] [--preset <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query workflow-preset-activation <path> --mode <id> [--provider <id>] [--preset <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query workflow-preset-diff <path> --provider <id> [--preset <id>]");
  console.log("   or: node ./src/cli.js query workflow-preset-customization <path> --provider <id> --preset <id>");
  console.log("   or: node ./src/cli.js workflow-preset customize <path> --provider <id> --preset <id> [--out <path>] [--write]");
  console.log("   or: node ./src/cli.js query lane-status <path> --mode import-adopt");
  console.log("   or: node ./src/cli.js query handoff-status <path> --mode import-adopt");
  console.log("   or: node ./src/cli.js query auth-hints <path>");
  console.log("   or: node ./src/cli.js query auth-review-packet <path> --bundle <slug>");
  console.log("   or: node ./src/cli.js reconcile <path> [--write]");
  console.log("   or: node ./src/cli.js reconcile adopt <selector> <path> [--refresh-adopted] [--write]");
  console.log("   or: node ./src/cli.js adoption status <path> [--write]");
  console.log("Targets: json-schema, docs, docs-index, verification-plan, verification-checklist, shape-transform-graph, shape-transform-debug, api-contract-graph, api-contract-debug, ui-contract-graph, ui-contract-debug, ui-widget-contract, widget-conformance-report, widget-behavior-report, ui-surface-contract, ui-surface-debug, sveltekit-app, swiftui-app, db-contract-graph, db-contract-debug, db-schema-snapshot, db-migration-plan, db-lifecycle-plan, db-lifecycle-bundle, environment-plan, environment-bundle, deployment-plan, deployment-bundle, runtime-smoke-plan, runtime-smoke-bundle, runtime-check-plan, runtime-check-bundle, compile-check-plan, compile-check-bundle, app-bundle-plan, app-bundle, native-parity-plan, native-parity-bundle, sql-migration, sql-schema, prisma-schema, drizzle-schema, persistence-scaffold, server-contract, hono-server, openapi, context-digest, context-diff, context-slice, context-bundle, context-report, context-task-mode");
  console.log("Workflows: import-app, scan-docs, reconcile, adoption-status, generate-docs, generate-journeys, refresh-docs, report-gaps");
  console.log("Import tracks: db, api, ui, workflows, verification");
  console.log("Reconcile adopt selectors: from-plan, actors, roles, enums, shapes, entities, capabilities, widgets, docs, journeys, workflows, ui, bundle:<slug>, projection-review:<id>, ui-review:<id>, workflow-review:<id>, bundle-review:<slug>");
}

/**
 * @returns {void}
 */
export function printNewHelp() {
  console.log("Usage: topogram new <path> [--template <alias|package|path>] [--catalog <path-or-source>]");
  console.log("   or: topogram new --list-templates [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Creates a new editable Topogram workspace from a template package or local template path.");
  console.log("");
  console.log("Fresh install flow:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("  npx topogram template list");
  console.log("  npx topogram new ./my-app --template hello-web");
  console.log("  cd ./my-app && npm install && npm run check && npm run generate");
  console.log("  npm --prefix app run compile");
  console.log("");
  console.log("Examples:");
  console.log("  topogram new ./my-app");
  console.log("  topogram new --list-templates");
  console.log("  topogram new ./my-app --template hello-web");
  console.log("  topogram new ./my-app --template ./local-template");
  console.log("  topogram new ./my-app --template @scope/topogram-template");
  console.log("");
  console.log("Default template: hello-web from the configured catalog.");
}

/**
 * @returns {void}
 */
export function printGenerateHelp() {
  console.log("Usage: topogram generate [path] [--out <path>]");
  console.log("   or: topogram generate app [path] [--out <path>]");
  console.log("");
  console.log("Defaults: path is ./topogram and app generation writes ./app.");
  console.log("Use `topogram emit <target>` for contracts, reports, snapshots, migration plans, and other artifacts.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram generate");
  console.log("  topogram generate ./topogram --out ./app");
  console.log("  topogram generate app ./topogram --out ./app");
}

/**
 * @returns {void}
 */
export function printEmitHelp() {
  console.log("Usage: topogram emit <target> [path] [--json]");
  console.log("   or: topogram emit <target> [path] --write [--out-dir <path>]");
  console.log("");
  console.log("Emits named contracts, reports, snapshots, migration plans, and other artifacts.");
  console.log("");
  console.log("Defaults: path is ./topogram. Emit prints to stdout unless --write is passed. --write writes ./artifacts unless --out-dir is supplied.");
  console.log("");
  console.log("Common artifact targets:");
  console.log("  ui-widget-contract");
  console.log("  widget-conformance-report");
  console.log("  widget-behavior-report");
  console.log("  context-slice");
  console.log("  context-diff");
  console.log("  verification-targets");
  console.log("");
  console.log("Selectors:");
  console.log("  --widget <id>");
  console.log("  --capability <id>");
  console.log("  --projection <id>");
  console.log("  --entity <id>");
  console.log("  --journey <id>");
  console.log("");
  console.log("Examples:");
  console.log("  topogram emit ui-widget-contract --widget widget_data_grid --json");
  console.log("  topogram emit widget-conformance-report ./topogram --projection proj_web_surface --json");
  console.log("  topogram emit widget-behavior-report ./topogram --projection proj_web_surface --json");
  console.log("  topogram emit db-schema-snapshot ./topogram --projection proj_db_postgres --json");
  console.log("  topogram emit sql-migration ./topogram --projection proj_db_postgres --from-snapshot ./state/current.json");
  console.log("  topogram emit ui-widget-contract --write --out-dir ./contracts");
}

/**
 * @returns {void}
 */
export function printWidgetHelp() {
  console.log("Usage: topogram widget check [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram widget behavior [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("");
  console.log("Checks projection widget_bindings usage against reusable widget contracts and behavior realizations.");
  console.log("");
  console.log("Defaults: path is ./topogram.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram widget check");
  console.log("  topogram widget check --projection proj_web_surface");
  console.log("  topogram widget check ./topogram --widget widget_data_grid --json");
  console.log("  topogram widget behavior");
  console.log("  topogram widget behavior --projection proj_web_surface");
  console.log("  topogram widget behavior ./topogram --widget widget_data_grid --json");
}
