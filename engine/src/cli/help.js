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
  console.log("   or: topogram release roll-consumers <version|--latest> [--json] [--no-push] [--watch|--no-watch]");
  console.log("Usage: topogram check [path] [--json]");
  console.log("   or: topogram widget check [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram widget behavior [path] [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: topogram agent brief [path] [--json]");
  console.log("   or: topogram sdlc policy init|check|explain [path] [--json]");
  console.log("   or: topogram sdlc gate [path] --base <ref> --head <ref> [--sdlc-id <id>] [--exemption <text>] [--require-adopted] [--json]");
  console.log("   or: topogram sdlc prep commit [path] [--base <ref> --head <ref>] [--json]");
  console.log("   or: topogram sdlc audit [path] [--json]");
  console.log("   or: topogram sdlc link <from-id> <to-id> [path] [--write]");
  console.log("   or: topogram sdlc complete <task-id> [path] --verification <verification-id> [--dry-run|--write]");
  console.log("   or: topogram sdlc plan create <task-id> <slug> [path] [--write]");
  console.log("   or: topogram sdlc plan explain <plan-id> [path] [--json]");
  console.log("   or: topogram sdlc plan step complete <plan-id> <step-id> [path] --actor <actor> [--write]");
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
  console.log("   or: topogram package update-cli <version|--latest> [--json]");
  console.log("   or: topogram copy <source> <target> [--version <version>] [--catalog <path-or-source>] [--json]");
  console.log("   or: topogram copy --list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram extract <app-path> --out <target> [--from <track[,track]>] [--extractor <id-or-package-or-path>] [--json]");
  console.log("   or: topogram extract refresh [path] [--from <app-path>] [--dry-run] [--json]");
  console.log("   or: topogram extract diff [path] [--json]");
  console.log("   or: topogram extract check [path] [--json]");
  console.log("   or: topogram extract plan [path] [--json]");
  console.log("   or: topogram adopt --list [path] [--json]");
  console.log("   or: topogram adopt <selector> [path] [--dry-run|--write] [--force --reason <text>] [--json]");
  console.log("   or: topogram extract status [path] [--json]");
  console.log("   or: topogram extract history [path] [--verify] [--json]");
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
  console.log("   or: topogram extractor list [--json]");
  console.log("   or: topogram extractor show <id-or-package> [--json]");
  console.log("   or: topogram extractor check <path-or-package> [--json]");
  console.log("   or: topogram extractor policy init [path] [--json]");
  console.log("   or: topogram extractor policy status [path] [--json]");
  console.log("   or: topogram extractor policy check [path] [--json]");
  console.log("   or: topogram extractor policy explain [path] [--json]");
  console.log("   or: topogram extractor policy pin [package@version] [path] [--json]");
  console.log("   or: topogram init [path] [--with-sdlc] [--json]");
  console.log("");
  console.log("Common commands:");
  console.log("  topogram version");
  console.log("  topogram doctor");
  console.log("  topogram setup package-auth");
  console.log("  topogram release status");
  console.log("  topogram release roll-consumers --latest");
  console.log("  topogram init .");
  console.log("  topogram copy --list");
  console.log("  topogram copy hello-web ./my-app");
  console.log("  topogram copy todo ./todo-app");
  console.log("  topogram check");
  console.log("  topogram check --json");
  console.log("  topogram widget check --projection proj_web_surface");
  console.log("  topogram widget behavior --projection proj_web_surface");
  console.log("  topogram agent brief");
  console.log("  topogram agent brief --json");
  console.log("  topogram sdlc policy explain");
  console.log("  topogram sdlc audit . --json");
  console.log("  topogram sdlc prep commit . --base origin/main --head HEAD");
  console.log("  topogram sdlc gate . --require-adopted");
  console.log("  topogram sdlc plan explain plan_example --json");
  console.log("  topogram query list");
  console.log("  topogram query show widget-behavior");
  console.log("  topogram query widget-behavior ./topo --projection proj_web_surface --json");
  console.log("  topogram emit ui-widget-contract --widget widget_data_grid --json");
  console.log("  topogram emit widget-conformance-report ./topo --projection proj_web_surface --json");
  console.log("  topogram generator list");
  console.log("  topogram generator show @topogram/generator-react-web");
  console.log("  topogram generator check ./generator-package");
  console.log("  topogram generator policy check");
  console.log("  topogram extractor list");
  console.log("  topogram extractor show @topogram/extractor-prisma-db");
  console.log("  topogram extractor check ./extractor-package");
  console.log("  topogram extractor policy check");
  console.log("  topogram extract ./express-api --out ./extracted-topogram --from api --extractor @topogram/extractor-express-api");
  console.log("  topogram generate");
  console.log("  topogram extract ./existing-app --out ./extracted-topogram");
  console.log("  topogram extract diff ./extracted-topogram");
  console.log("  topogram extract refresh ./extracted-topogram --from ./existing-app --dry-run");
  console.log("  topogram extract check ./extracted-topogram");
  console.log("  topogram extract plan ./extracted-topogram");
  console.log("  topogram adopt --list ./extracted-topogram");
  console.log("  topogram adopt bundle:task ./extracted-topogram --dry-run");
  console.log("  topogram extract status ./extracted-topogram");
  console.log("  topogram extract history ./extracted-topogram --verify");
  console.log("");
  console.log("Fresh install:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("  npx topogram doctor");
  console.log("  npx topogram template list");
  console.log("  npx topogram init .");
  console.log("  npx topogram copy hello-web ./my-app");
  console.log("  cd ./my-app && npm install && npm run check && npm run generate");
  console.log("  npm --prefix app run compile");
  console.log("");
  console.log("Template and catalog discovery:");
  console.log("  topogram template list");
  console.log("  topogram catalog list");
  console.log("  topogram catalog show todo");
  console.log("  topogram catalog doctor");
  console.log("  topogram catalog check topograms.catalog.json");
  console.log("  topogram copy hello ./hello-topogram");
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
  console.log("Defaults: check/generate use ./topo, and generate writes ./app.");
  console.log("Default starter: hello-web from the catalog. Run `topogram copy --list` for catalog aliases.");
  console.log("Generated app commands are emitted into the output package.json.");
  console.log("Run `topogram help <command>` for command-specific help.");
  console.log("Run `topogram help all` for legacy and agent-facing commands.");
  if (!all) {
    return;
  }
  console.log("");
  console.log("Internal commands:");
  console.log("   or: topogram template show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram validate <path>");
  console.log("   or: node ./src/cli.js query work-packet <path> --mode extract-adopt --lane <id>");
  console.log("   or: node ./src/cli.js <path> [--json] [--validate] [--resolve] [--workflow <name>] [--mode <id>] [--from <track[,track]>] [--adopt <selector>] [--refresh-adopted] [--shape <id>] [--capability <id>] [--widget <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--task <id>] [--profile <id>] [--from-snapshot <path>] [--from-topogram <path>] [--write] [--out-dir <path>]");
  console.log("   or: node ./src/cli.js emit <target> [path] [--json] [--write] [--out-dir <path>]");
  console.log("   or: node ./src/cli.js generate journeys <path> [--write]");
  console.log("   or: node ./src/cli.js report gaps <path> [--write]");
  console.log("   or: node ./src/cli.js query task-mode <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query adoption-plan <path>");
  console.log("   or: node ./src/cli.js query maintained-boundary <path>");
  console.log("   or: node ./src/cli.js query maintained-conformance <path> [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query maintained-drift <path> --from-topogram <path>");
  console.log("   or: node ./src/cli.js query seam-check <path> [--seam <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query diff <path> --from-topogram <path>");
  console.log("   or: node ./src/cli.js query slice <path> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--domain <id>] [--task <id>] [--plan <id>] [--bug <id>]");
  console.log("   or: node ./src/cli.js query domain-list <path>");
  console.log("   or: node ./src/cli.js query domain-coverage <path> --domain <id>");
  console.log("   or: node ./src/cli.js query review-boundary <path> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>]");
  console.log("   or: node ./src/cli.js query write-scope <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query verification-targets <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query widget-behavior <path> [--projection <id>] [--widget <id>] [--json]");
  console.log("   or: node ./src/cli.js query change-plan <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query extract-plan <path>");
  console.log("   or: node ./src/cli.js query risk-summary <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query canonical-writes <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query proceed-decision <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query review-packet <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query next-action <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query single-agent-plan <path> --mode <id> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--task <id>] [--plan <id>] [--bug <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query multi-agent-plan <path> --mode extract-adopt");
  console.log("   or: node ./src/cli.js query resolved-workflow-context <path> --mode <id> [--capability <id>] [--workflow <id>] [--projection <id>] [--widget <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--provider <id>] [--preset <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query workflow-preset-activation <path> --mode <id> [--provider <id>] [--preset <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query workflow-preset-diff <path> --provider <id> [--preset <id>]");
  console.log("   or: node ./src/cli.js query workflow-preset-customization <path> --provider <id> --preset <id>");
  console.log("   or: node ./src/cli.js workflow-preset customize <path> --provider <id> --preset <id> [--out <path>] [--write]");
  console.log("   or: node ./src/cli.js query lane-status <path> --mode extract-adopt");
  console.log("   or: node ./src/cli.js query handoff-status <path> --mode extract-adopt");
  console.log("   or: node ./src/cli.js query auth-hints <path>");
  console.log("   or: node ./src/cli.js query auth-review-packet <path> --bundle <slug>");
  console.log("   or: node ./src/cli.js reconcile <path> [--write]");
  console.log("   or: node ./src/cli.js reconcile adopt <selector> <path> [--refresh-adopted] [--write]");
  console.log("   or: node ./src/cli.js adoption status <path> [--write]");
  console.log("Targets: json-schema, docs, docs-index, verification-plan, verification-checklist, shape-transform-graph, shape-transform-debug, api-contract-graph, api-contract-debug, ui-contract-graph, ui-contract-debug, ui-widget-contract, widget-conformance-report, widget-behavior-report, ui-surface-contract, ui-surface-debug, sveltekit-app, swiftui-app, db-contract-graph, db-contract-debug, db-schema-snapshot, db-migration-plan, db-lifecycle-plan, db-lifecycle-bundle, environment-plan, environment-bundle, deployment-plan, deployment-bundle, runtime-smoke-plan, runtime-smoke-bundle, runtime-check-plan, runtime-check-bundle, compile-check-plan, compile-check-bundle, app-bundle-plan, app-bundle, native-parity-plan, native-parity-bundle, sql-migration, sql-schema, prisma-schema, drizzle-schema, persistence-scaffold, server-contract, hono-server, openapi, context-digest, context-diff, context-slice, context-bundle, context-report, context-task-mode");
  console.log("Workflows: scan-docs, reconcile, adoption-status, generate-docs, generate-journeys, refresh-docs, report-gaps");
  console.log("Extract tracks: db, api, ui, cli, workflows, verification");
  console.log("Reconcile adopt selectors: from-plan, actors, roles, enums, shapes, entities, capabilities, widgets, docs, journeys, workflows, ui, bundle:<slug>, projection-review:<id>, ui-review:<id>, workflow-review:<id>, bundle-review:<slug>");
}

/**
 * @returns {void}
 */
export function printCopyHelp() {
  console.log("Usage: topogram copy <source> <target> [--version <version>] [--catalog <path-or-source>] [--json]");
  console.log("   or: topogram copy --list [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Copies a catalog template, template package/path, or pure Topogram source into a new project directory.");
  console.log("");
  console.log("Fresh install flow:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("  npx topogram copy --list");
  console.log("  npx topogram copy hello-web ./my-app");
  console.log("  cd ./my-app && npm install && npm run check && npm run generate");
  console.log("  npm --prefix app run compile");
  console.log("");
  console.log("Examples:");
  console.log("  topogram copy --list");
  console.log("  topogram copy hello-web ./my-app");
  console.log("  topogram copy todo ./todo-app");
  console.log("  topogram copy ./local-template ./my-app");
  console.log("  topogram copy @scope/topogram-template ./my-app");
  console.log("");
  console.log("Template entries create starter projects. Topogram entries copy editable topo/ source.");
}

/**
 * @returns {void}
 */
export function printInitHelp() {
  console.log("Usage: topogram init [path] [--with-sdlc] [--json]");
  console.log("");
  console.log("Initializes an empty Topogram workspace in an existing or new repository without copying a template.");
  console.log("");
  console.log("Defaults: path is the current directory. Init creates topo/, topogram.project.json, and starter guidance files only when they are missing.");
  console.log("The default output is maintained ownership for '.', so Topogram will not overwrite app source.");
  console.log("--with-sdlc also writes topogram.sdlc-policy.json with adopted/enforced defaults.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram init");
  console.log("  topogram init . --with-sdlc");
  console.log("  topogram init . --json");
  console.log("  topogram init ./existing-app");
}

/**
 * @returns {void}
 */
export function printGenerateHelp() {
  console.log("Usage: topogram generate [path] [--out <path>]");
  console.log("   or: topogram generate app [path] [--out <path>]");
  console.log("");
  console.log("Defaults: path is ./topo and app generation writes ./app.");
  console.log("Use `topogram emit <target>` for contracts, reports, snapshots, migration plans, and other artifacts.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram generate");
  console.log("  topogram generate ./topo --out ./app");
  console.log("  topogram generate app ./topo --out ./app");
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
  console.log("Defaults: path is ./topo. Emit prints to stdout unless --write is passed. --write writes ./artifacts unless --out-dir is supplied.");
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
  console.log("  topogram emit widget-conformance-report ./topo --projection proj_web_surface --json");
  console.log("  topogram emit widget-behavior-report ./topo --projection proj_web_surface --json");
  console.log("  topogram emit db-schema-snapshot ./topo --projection proj_db_postgres --json");
  console.log("  topogram emit sql-migration ./topo --projection proj_db_postgres --from-snapshot ./state/current.json");
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
  console.log("Defaults: path is ./topo.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram widget check");
  console.log("  topogram widget check --projection proj_web_surface");
  console.log("  topogram widget check ./topo --widget widget_data_grid --json");
  console.log("  topogram widget behavior");
  console.log("  topogram widget behavior --projection proj_web_surface");
  console.log("  topogram widget behavior ./topo --widget widget_data_grid --json");
}
