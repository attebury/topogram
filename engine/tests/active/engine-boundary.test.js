import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const testsRoot = path.join(repoRoot, "engine", "tests");
const activeTestsRoot = path.join(testsRoot, "active");
const fixturesRoot = path.join(testsRoot, "fixtures");
const appBasicRoots = [
  path.join(fixturesRoot, "workspaces", "app-basic"),
  path.join(fixturesRoot, "expected", "app-basic")
];
const nativeGeneratorRoot = path.join(repoRoot, "engine", "src", "generator", "surfaces", "native");
const productNameLower = ["to", "do"].join("");
const productNameTitle = ["To", "do"].join("");
const generatedWorkflowBoundaryFile = path.join(activeTestsRoot, "generated-app-workflow.test.js");
const forbiddenDemoReferences = [
  ["demos", "generated"].join("/"),
  [productNameLower, "demo", "app"].join("-")
];
const forbiddenFixtureReferences = [
  "TODO_",
  productNameTitle,
  ["topogram", productNameLower].join("_"),
  ["topogram", productNameLower].join("-")
];
const forbiddenAppBasicProductArtifacts = [
  "taskList",
  "taskDetail",
  "taskCreate",
  "taskEdit",
  "taskExports",
  "taskListLookups",
  "taskCreateLookups",
  "taskEditLookups",
  "task-list",
  "task-meta",
  "cap_list_tasks",
  "cap_create_task",
  "cap_update_task",
  "cap_delete_task",
  "cap_complete_task",
  "entity_task",
  "entity_project",
  "entity_user",
  "/tasks",
  "/projects",
  "/users",
  "tasks/",
  "projects/",
  "users/",
  "TOPOGRAM_DEMO_TASK_ID",
  "PUBLIC_TOPOGRAM_DEMO_TASK_ID",
  "TOPOGRAM_DEMO_PROJECT_ID",
  "PUBLIC_TOPOGRAM_DEMO_PROJECT_ID"
];
const forbiddenNativeGeneratorProductArtifacts = [
  [productNameTitle, "SwiftUIApp"].join(""),
  [productNameTitle, "APIClient"].join(""),
  [productNameTitle, "UiContract"].join(""),
  "PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN",
  "cap_complete_task",
  "cap_export_tasks",
  "cap_update_task",
  "cap_get_task",
  "task_list",
  "task_detail",
  "task_create",
  "task_exports"
];
const externalProductReferences = [
  productNameLower,
  productNameTitle,
  ["topogram", "template", productNameLower].join("-"),
  ["topogram", "demo", productNameLower].join("-"),
  ["topogram", productNameLower].join("-"),
  ["@topogram", ["template", productNameLower].join("-")].join("/")
];
const generatedWorkflowDirectProductReferences = [
  JSON.stringify(productNameLower),
  ["topogram", "template", productNameLower].join("-"),
  ["topogram", "demo", productNameLower].join("-"),
  ["@topogram", ["template", productNameLower].join("-")].join("/")
];
const removedGenerateArtifactReferences = ["--generate"];
const removedGenerateArtifactAllowedFiles = new Set([
  "engine/src/cli/migration-guidance.js",
  "engine/tests/active/dsl-migration-diagnostics.test.js",
  "engine/tests/active/engine-boundary.test.js",
  "engine/tests/active/generated-app-workflow.test.js"
]);
const staleDslVocabulary = [
  "component-behavior",
  "component_conformance",
  "component_behavior",
  "component_ui_",
  "proj_ui_web",
  "proj_ui_shared",
  "topogram/components",
  "data-topogram-component",
  "component_usages",
  "rendered_component_usages",
  "componentContract",
  "component_ids",
  "changed_component",
  "graph.byKind.component",
  "uiComponents",
  "ui-web-contract",
  "topology.components",
  "topology.widgets",
  "ui_shared",
  "ui_web",
  "ui_ios",
  "ui_android",
  "ui_components",
  "ui_routes",
  "ui_design",
  "ui_screens",
  "ui_screen_regions",
  "ui_navigation",
  "ui_app_shell",
  "ui_collections",
  "ui_actions",
  "ui_visibility",
  "ui_lookups",
  "http_errors",
  "http_fields",
  "http_responses",
  "http_preconditions",
  "http_idempotency",
  "http_cache",
  "http_delete",
  "http_async",
  "http_status",
  "http_download",
  "http_authz",
  "http_callbacks",
  "db_tables",
  "db_columns",
  "db_keys",
  "db_indexes",
  "db_relations",
  "db_postgres",
  "db_sqlite",
  "projectionPlatforms",
  "componentSupport"
];
const staleDslVocabularyAllowedFiles = new Set([
  "docs/components.md",
  "engine/src/cli/migration-guidance.js",
  "engine/src/cli/help.js",
  "engine/src/generator/registry.js",
  "engine/src/project-config.js",
  "engine/src/validator/common.js"
]);
const legacyRuntimeAliasReferences = [
  "context.component",
  "apiComponent",
  "databaseComponent",
  "apiComponents",
  "webComponents",
  "dbComponents"
];
const legacyRuntimeAliasAllowedFiles = new Set([
  "engine/src/generator/adapters.js",
  "engine/src/generator/runtime/shared.js",
  "engine/tests/active/engine-boundary.test.js",
  "engine/tests/active/project-config.test.js"
]);
const npmUserconfigAllowedFiles = new Set([
  "engine/src/npm-safety.js",
  "engine/tests/active/engine-boundary.test.js",
  "engine/tests/active/hardening-safety.test.js"
]);
const generatedHtmlAllowedFiles = new Set([
  "engine/src/generator/surfaces/web/html-escape.js",
  "engine/tests/active/engine-boundary.test.js",
  "engine/tests/active/hardening-safety.test.js"
]);
const helperDefinitionAllowedFiles = new Set([
  "engine/src/text-helpers.js",
  "engine/src/path-helpers.js",
  "engine/tests/active/engine-boundary.test.js"
]);
const runtimeDefaultAllowedFiles = new Set([
  "engine/src/topogram-config.js",
  "engine/tests/active/engine-boundary.test.js"
]);
const githubShellAllowedFiles = new Set([
  "engine/src/github-client.js",
  "engine/tests/active/engine-boundary.test.js"
]);

function visitFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const next = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...visitFiles(next));
    } else {
      files.push(next);
    }
  }
  return files;
}

test("engine tests do not reference generated demo workspaces", () => {
  const offenders = [];
  for (const file of visitFiles(testsRoot)) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (forbiddenDemoReferences.some((reference) => contents.includes(reference))) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("engine fixtures do not carry product-specific vocabulary", () => {
  const offenders = [];
  for (const file of visitFiles(fixturesRoot)) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (forbiddenFixtureReferences.some((reference) => contents.includes(reference))) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("app-basic stays neutral instead of reintroducing old product artifacts", () => {
  const offenders = [];
  for (const root of appBasicRoots) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      const contents = fs.readFileSync(file, "utf8");
      const references = forbiddenAppBasicProductArtifacts.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("native generator templates stay neutral instead of reintroducing product behavior", () => {
  const offenders = [];
  for (const file of visitFiles(nativeGeneratorRoot)) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    const references = forbiddenNativeGeneratorProductArtifacts.filter((reference) => contents.includes(reference));
    if (references.length > 0) {
      offenders.push({ file: relative, references });
    }
  }

  assert.deepEqual(offenders, []);
});

test("active engine tests keep product-specific references in the named boundary file", () => {
  const offenders = [];
  for (const file of visitFiles(activeTestsRoot)) {
    if (file === generatedWorkflowBoundaryFile) continue;
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (externalProductReferences.some((reference) => contents.includes(reference))) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("generated workflow keeps direct product literals near named constants", () => {
  const contents = fs.readFileSync(generatedWorkflowBoundaryFile, "utf8");
  const boundaryIndex = contents.indexOf("function createPureTopogramPackage");
  assert.notEqual(boundaryIndex, -1);
  const tail = contents.slice(boundaryIndex);
  const offenders = generatedWorkflowDirectProductReferences.filter((reference) => tail.includes(reference));

  assert.deepEqual(offenders, []);
});

test("old public DSL vocabulary only appears in migration guidance", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "docs"), path.join(repoRoot, "engine", "src"), path.join(repoRoot, "scripts")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (staleDslVocabularyAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const references = staleDslVocabulary.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("removed generate artifact flag only appears in migration guidance", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "docs"), path.join(repoRoot, "engine", "src"), path.join(repoRoot, "engine", "tests", "active"), path.join(repoRoot, "scripts")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (removedGenerateArtifactAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const references = removedGenerateArtifactReferences.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("legacy generator runtime aliases stay isolated to adapter compatibility", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "engine", "src"), path.join(repoRoot, "engine", "tests", "active")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (legacyRuntimeAliasAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const references = legacyRuntimeAliasReferences.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("catalog URL reads do not shell out to curl", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (contents.includes('spawnSync("curl"') || contents.includes("spawnSync('curl'")) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("local npm userconfig is controlled only by npm safety helper", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "engine", "src"), path.join(repoRoot, "engine", "tests", "active")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (npmUserconfigAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      if (contents.includes("NPM_CONFIG_USERCONFIG")) {
        offenders.push(relative);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("web generator HTML interpolation uses shared escaping helpers", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src", "generator", "surfaces", "web"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (generatedHtmlAllowedFiles.has(relative)) continue;
    const contents = fs.readFileSync(file, "utf8");
    if ((contents.includes("<!doctype html>") || contents.includes("<html")) && !contents.includes("escapeHtml")) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("candidate naming and stopword helpers have one source of truth", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (helperDefinitionAllowedFiles.has(relative)) continue;
    const contents = fs.readFileSync(file, "utf8");
    const references = [
      "function canonicalCandidateTerm",
      "function pluralizeCandidateTerm",
      "const STOPWORDS",
      "const GENERIC_STOPWORDS",
      "const TECHNICAL_STOPWORDS"
    ].filter((reference) => contents.includes(reference));
    if (references.length > 0) {
      offenders.push({ file: relative, references });
    }
  }

  assert.deepEqual(offenders, []);
});

test("repo and catalog owner defaults stay isolated to runtime config", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (runtimeDefaultAllowedFiles.has(relative)) continue;
    const contents = fs.readFileSync(file, "utf8");
    const references = [
      "attebury/",
      "github.com/attebury",
      "raw.githubusercontent.com/attebury",
      "owner: \"attebury\""
    ].filter((reference) => contents.includes(reference));
    if (references.length > 0) {
      offenders.push({ file: relative, references });
    }
  }

  assert.deepEqual(offenders, []);
});

test("GitHub shell fallback stays isolated to the GitHub client", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (githubShellAllowedFiles.has(relative)) continue;
    const contents = fs.readFileSync(file, "utf8");
    const references = [
      'spawnSync("gh"',
      "spawnSync('gh'",
      '"gh", ["auth"',
      '"gh", ["run"',
      '"gh", ["api"'
    ].filter((reference) => contents.includes(reference));
    if (references.length > 0) {
      offenders.push({ file: relative, references });
    }
  }

  assert.deepEqual(offenders, []);
});

test("split CLI command families stay out of the binary shim", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "cli.js"), "utf8");
  const forbiddenDefinitions = [
    "function printSetupHelp(",
    "function printPackageAuthSetup(",
    "function printCatalogAuthSetup(",
    "function printCommandHelp(",
    "function handleGlobalHelp(",
    "function handleUnparsedCommandHelp(",
    "function normalizeTopogramPath(",
    "function normalizeProjectRoot(",
    "function runCliDispatch(",
    "function buildVersionPayload(",
    "function printVersion(",
    "function printUsage(",
    "function printNewHelp(",
    "function displayProjectRootForNewProject(",
    "function printNewProjectResult(",
    "function runNewProjectCommand(",
    "function assertSafeGeneratedOutputDir(",
    "function assertProjectOutputAllowsWrite(",
    "function generatedOutputSentinel(",
    "function topogramInputPathForGeneration(",
    "function targetRequiresImplementationProvider(",
    "function runGenerateAppCommand(",
    "function runEmitCommand(",
    "function printGenerateHelp(",
    "function printEmitHelp(",
    "function printWidgetHelp(",
    "function printAgentHelp(",
    "function runAgentBriefCommand(",
    "function printWidgetConformanceReport(",
    "function printWidgetBehaviorReport(",
    "function runWidgetCheckCommand(",
    "function runWidgetBehaviorCommand(",
    "function runCheckCommand(",
    "function summarize(",
    "function runResolveCommand(",
    "function runParseCommand(",
    "function cliMigrationError(",
    "function artifactTargetMigrationError(",
    "function parseCliOptions(",
    "function optionValue(",
    "function printImportHelp(",
    "function buildBrownfieldImportWorkspacePayload(",
    "function printBrownfieldImportWorkspace(",
    "function buildBrownfieldImportRefreshPayload(",
    "function printBrownfieldImportRefresh(",
    "function buildBrownfieldImportDiffPayload(",
    "function printBrownfieldImportDiff(",
    "function buildBrownfieldImportCheckPayload(",
    "function printBrownfieldImportCheck(",
    "function buildBrownfieldImportPlanPayload(",
    "function printBrownfieldImportPlan(",
    "function buildBrownfieldImportAdoptListPayload(",
    "function printBrownfieldImportAdoptList(",
    "function buildBrownfieldImportAdoptPayload(",
    "function printBrownfieldImportAdopt(",
    "function buildBrownfieldImportStatusPayload(",
    "function printBrownfieldImportStatus(",
    "function buildBrownfieldImportHistoryPayload(",
    "function printBrownfieldImportHistory(",
    "function printCatalogHelp(",
    "function buildCatalogListPayload(",
    "function printCatalogList(",
    "function buildCatalogShowPayload(",
    "function catalogShowCommands(",
    "function printCatalogShow(",
    "function runCatalogCommand(",
    "function buildCatalogDoctorPayload(",
    "function runNpmViewPackageSpec(",
    "function catalogDoctorPackageDiagnostic(",
    "function printCatalogDoctor(",
    "function buildCatalogCheckPayload(",
    "function printCatalogCheck(",
    "function buildCatalogCopyPayload(",
    "function printCatalogCopy(",
    "function printPackageHelp(",
    "function buildPackageUpdateCliPayload(",
    "function printPackageUpdateCli(",
    "function runPackageCommand(",
    "function readProjectCliDependencySpec(",
    "function isLocalCliDependencySpec(",
    "function checkDoctorNode(",
    "function checkDoctorNpm(",
    "function readInstalledCliPackageVersion(",
    "function npmConfigGet(",
    "function normalizeRegistryUrl(",
    "function checkDoctorPackageAccess(",
    "function registryPackageNameFromSpec(",
    "function checkTemplatePackageStatus(",
    "function localTemplatePackageStatus(",
    "function latestTopogramCliVersion(",
    "function inspectTopogramCliLockfile(",
    "function isPackageVersion(",
    "function queryDefinitions(",
    "function buildQueryListPayload(",
    "function buildQueryShowPayload(",
    "function printQueryHelp(",
    "function printQueryDefinition(",
    "function printQueryList(",
    "function runQueryCommand(",
    "function runSdlcCommand(",
    "function runValidateCommand(",
    "function runLegacyWorkflowCommand(",
    "function printGeneratorHelp(",
    "function printGeneratorCheck(",
    "function runGeneratorCommand(",
    "function buildGeneratorListPayload(",
    "function buildGeneratorShowPayload(",
    "function printGeneratorList(",
    "function printGeneratorShow(",
    "function runGeneratorPolicyCommand(",
    "function buildGeneratorPolicyCheckPayload(",
    "function buildGeneratorPolicyExplainPayload(",
    "function buildGeneratorPolicyStatusPayload(",
    "function buildGeneratorPolicyInitPayload(",
    "function buildGeneratorPolicyPinPayload(",
    "function printGeneratorPolicyCheckPayload(",
    "function printGeneratorPolicyStatusPayload(",
    "function printGeneratorPolicyExplainPayload(",
    "function printGeneratorPolicyInitPayload(",
    "function printGeneratorPolicyPinPayload(",
    "function runReleaseCommand(",
    "function buildReleaseStatusPayload(",
    "function buildReleaseRollConsumersPayload(",
    "function printTemplateHelp(",
    "function buildTemplateListPayload(",
    "function printTemplateList(",
    "function buildTemplateShowPayload(",
    "function printTemplateShow(",
    "function templateMetadataFromProjectConfig(",
    "function latestVersionForPackage(",
    "function latestTemplateInfo(",
    "function buildTemplateStatusPayload(",
    "function printTemplateStatus(",
    "function buildTemplateExplainPayload(",
    "function printTemplateExplain(",
    "function buildTemplateDetachPayload(",
    "function printTemplateDetachPayload(",
    "function buildTemplateOwnedBaselineStatus(",
    "function templateCheckDiagnostic(",
    "function buildTemplateCheckPayload(",
    "function printTemplateCheckPayload(",
    "function buildTemplatePolicyCheckPayload(",
    "function printTemplatePolicyCheckPayload(",
    "function buildTemplatePolicyExplainPayload(",
    "function printTemplatePolicyExplainPayload(",
    "function buildTemplatePolicyPinPayload(",
    "function printTemplatePolicyPinPayload(",
    "function printTemplateUpdatePlan(",
    "function buildTemplateUpdateRecommendationPayload(",
    "function printTemplateUpdateRecommendation(",
    "function buildTemplateUpdateCliPayload(",
    "function templateListItemFromCatalogEntry(",
    "function templateDecisionSummary(",
    "function runTemplateCommand(",
    "function runImportCommand(",
    "function runSourceCommand(",
    "function runTrustCommand(",
    "commandArgs = { version:",
    "commandArgs = { queryList:",
    "commandArgs = { queryShow:",
    "commandArgs = { queryName:",
    "commandArgs = { workflowPresetCommand:",
    "commandArgs = { newProject:",
    'commandArgs = { generateTarget: "app-bundle"',
    "commandArgs = { generateTarget: args[1]",
    "commandArgs = { agentBrief:",
    "commandArgs = { widgetCheck:",
    "commandArgs = { widgetBehavior:",
    "commandArgs = { validate:",
    "commandArgs = { workflowName:",
    "commandArgs = { sdlcCommand:",
    "commandArgs = { catalogCommand:",
    "commandArgs = { packageCommand:",
    "commandArgs = { sourceCommand:",
    "commandArgs = { trustCommand:",
    "commandArgs = { generatorCommand:",
    "commandArgs = { generatorPolicyCommand:",
    "commandArgs = { templateCommand:",
    "commandArgs = { importCommand:",
    "commandArgs = { releaseCommand:"
  ];
  const offenders = forbiddenDefinitions.filter((reference) => contents.includes(reference));

  assert.deepEqual(offenders, []);
});

test("split command parser stays a command-family composition root", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "cli", "command-parser.js"), "utf8");
  const forbiddenParserDetails = [
    "if (args[0]",
    "else if (args[0]",
    "const QUERY_NAMES",
    "function commandPath(",
    "function commandOperandFrom("
  ];
  const offenders = forbiddenParserDetails.filter((reference) => contents.includes(reference));

  assert.deepEqual(offenders, []);
});

test("workflow entrypoint stays dispatch-only after workflow split", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "workflows.js"), "utf8");
  const lines = contents.split(/\r?\n/).filter(Boolean);
  const forbiddenWorkflowDetails = [
    "from \"node:fs\"",
    "from \"node:path\"",
    "parsePath",
    "resolveWorkspace",
    "function scanDocsWorkflow",
    "function importAppWorkflow",
    "function reconcileWorkflow",
    "function adoptionStatusWorkflow",
    "function reportGapsWorkflow",
    "function refreshDocsWorkflow"
  ];
  const offenders = forbiddenWorkflowDetails.filter((reference) => contents.includes(reference));

  assert.equal(lines.length <= 80, true);
  assert.deepEqual(offenders, []);
  assert.match(contents, /from "\.\/workflows\//);
});

test("workflow implementation modules stay focused after split", () => {
  const roots = [
    path.join(repoRoot, "engine", "src", "workflows")
  ];
  const offenders = [];
  for (const root of roots) {
    for (const file of visitFiles(root).filter((item) => item.endsWith(".js"))) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      const lineCount = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
      if (lineCount > 800) {
        offenders.push({ file: relative, lineCount });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("workflow implementation modules stay in the active type-check lane", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src", "workflows")).filter((item) => item.endsWith(".js"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (contents.includes("@ts-nocheck")) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("agent query builder entrypoint stays dispatch-only after split", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "agent-ops", "query-builders.js"), "utf8");
  const lines = contents.split(/\r?\n/).filter(Boolean);
  const forbiddenDetails = [
    "from \"node:fs\"",
    "from \"node:path\"",
    "function build",
    "function summarize",
    "const WORKFLOW_QUERY_FAMILIES_BY_MODE"
  ];
  const offenders = forbiddenDetails.filter((reference) => contents.includes(reference));

  assert.equal(lines.length <= 80, true);
  assert.deepEqual(offenders, []);
  assert.match(contents, /from "\.\/query-builders\//);
});

test("agent query builder modules stay focused after split", () => {
  const offenders = [];
  const root = path.join(repoRoot, "engine", "src", "agent-ops", "query-builders");

  for (const file of visitFiles(root).filter((item) => item.endsWith(".js"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    const lineCount = contents.split(/\r?\n/).length;
    if (lineCount > 800 || contents.includes("@ts-nocheck")) {
      offenders.push({ file: relative, lineCount, nocheck: contents.includes("@ts-nocheck") });
    }
  }

  assert.deepEqual(offenders, []);
});

test("agent query builder declarations do not use broad rest-any inputs", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "agent-ops", "query-builders.d.ts"), "utf8");

  assert.equal(contents.includes("...args: any[]"), false);
});

test("resolver entrypoint stays orchestration-focused after resolver split", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "resolver", "index.js"), "utf8");
  const lines = contents.split(/\r?\n/).filter(Boolean);
  const forbiddenDetails = [
    "function normalizeStatement(",
    "function parseProjection",
    "function normalizeComponent",
    "function buildWidgetContract(",
    "function parseKeyBlock(",
    "function projectShapeFields(",
    "function deriveShapeFields("
  ];
  const offenders = forbiddenDetails.filter((reference) => contents.includes(reference));

  assert.equal(lines.length <= 500, true);
  assert.deepEqual(offenders, []);
  assert.match(contents, /from "\.\/normalize\.js"/);
  assert.match(contents, /export \{ normalizeStatement \} from "\.\/normalize\.js"/);
});

test("resolver implementation modules stay focused after split", () => {
  const offenders = [];
  const root = path.join(repoRoot, "engine", "src", "resolver");

  for (const file of visitFiles(root).filter((item) => item.endsWith(".js"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    const lineCount = contents.split(/\r?\n/).length;
    if (lineCount > 800 || contents.includes("@ts-nocheck")) {
      offenders.push({ file: relative, lineCount, nocheck: contents.includes("@ts-nocheck") });
    }
  }

  assert.deepEqual(offenders, []);
});

test("resolver support modules do not import from resolver index", () => {
  const offenders = [];
  const root = path.join(repoRoot, "engine", "src", "resolver");

  for (const file of visitFiles(root).filter((item) => item.endsWith(".js"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (relative === "engine/src/resolver/index.js") continue;
    const contents = fs.readFileSync(file, "utf8");
    if (contents.includes('from "./index.js"') || contents.includes("from './index.js'")) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("resolver and validator leaf modules stay in the active type-check lane", () => {
  const checkedFiles = [
    "engine/src/parser.js",
    "engine/src/validator/kinds.js",
    "engine/src/validator/utils.js",
    "engine/src/validator/model-helpers.js",
    "engine/src/validator/common.js",
    "engine/src/validator/data-model.js",
    "engine/src/validator/registry.js",
    "engine/src/validator/docs.js",
    "engine/src/validator/expressions.js",
    "engine/src/validator/projections/helpers.js",
    "engine/src/validator/projections/api-http.js",
    "engine/src/validator/projections/api-http-async.js",
    "engine/src/validator/projections/api-http-authz.js",
    "engine/src/validator/projections/api-http-core.js",
    "engine/src/validator/projections/api-http-policies.js",
    "engine/src/validator/projections/api-http-responses.js",
    "engine/src/validator/projections/db.js",
    "engine/src/validator/projections/generator-defaults.js",
    "engine/src/validator/projections/ui.js",
    "engine/src/validator/projections/ui-helpers.js",
    "engine/src/validator/projections/ui-navigation.js",
    "engine/src/validator/projections/ui-structure.js",
    "engine/src/validator/projections/ui-widgets.js",
    "engine/src/validator/per-kind/acceptance-criterion.js",
    "engine/src/validator/per-kind/bug.js",
    "engine/src/validator/per-kind/domain.js",
    "engine/src/validator/per-kind/pitch.js",
    "engine/src/validator/per-kind/requirement.js",
    "engine/src/validator/per-kind/task.js",
    "engine/src/validator/per-kind/widget.js",
    "engine/src/resolver/enrich/acceptance-criterion.js",
    "engine/src/resolver/enrich/bug.js",
    "engine/src/resolver/enrich/pitch.js",
    "engine/src/resolver/enrich/requirement.js",
    "engine/src/resolver/enrich/task.js"
  ];
  const tsconfig = JSON.parse(fs.readFileSync(path.join(repoRoot, "engine", "tsconfig.check.json"), "utf8"));
  const tsconfigFiles = new Set(tsconfig.files.map((file) => path.normalize(path.join("engine", file))));
  const missingFromTypeCheck = [];
  const nocheckOffenders = [];

  for (const relative of checkedFiles) {
    if (!tsconfigFiles.has(path.normalize(relative))) {
      missingFromTypeCheck.push(relative);
    }
    const contents = fs.readFileSync(path.join(repoRoot, relative), "utf8");
    if (contents.includes("@ts-nocheck")) {
      nocheckOffenders.push(relative);
    }
  }

  assert.deepEqual(missingFromTypeCheck, []);
  assert.deepEqual(nocheckOffenders, []);
});

test("validator support modules do not re-export from validator index", () => {
  const checkedFiles = visitFiles(path.join(repoRoot, "engine", "src", "validator"))
    .filter((item) => item.endsWith(".js"))
    .map((file) => path.relative(repoRoot, file).replace(/\\/g, "/"));
  const offenders = [];

  for (const relative of checkedFiles) {
    const contents = fs.readFileSync(path.join(repoRoot, relative), "utf8");
    if (contents.includes('from "./index.js"') || contents.includes("from './index.js'")) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("validator modules do not reintroduce ts-nocheck", () => {
  const offenders = [];
  for (const file of visitFiles(path.join(repoRoot, "engine", "src", "validator")).filter((item) => item.endsWith(".js"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (contents.includes("@ts-nocheck")) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("validator index stays an orchestrator after validation group split", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "validator", "index.js"), "utf8");
  const functionDeclarations = [...contents.matchAll(/^function /gm)].length;
  const lines = contents.split(/\r?\n/);

  assert.equal(functionDeclarations, 0);
  assert.equal(lines.length <= 180, true);
  assert.match(contents, /validateCoreStatement/);
  assert.match(contents, /validateApiHttpProjection/);
  assert.match(contents, /validateUiProjection/);
  assert.match(contents, /validateDbProjection/);
});

test("validator implementation modules stay focused after split", () => {
  const offenders = [];
  const root = path.join(repoRoot, "engine", "src", "validator");

  for (const file of visitFiles(root).filter((item) => item.endsWith(".js"))) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const lineCount = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
    if (lineCount > 800) {
      offenders.push({ file: relative, lineCount });
    }
  }

  assert.deepEqual(offenders, []);
});

test("validator expressions module owns expression validation", () => {
  const contents = fs.readFileSync(path.join(repoRoot, "engine", "src", "validator", "expressions.js"), "utf8");

  assert.match(contents, /export function validateExpressions/);
  assert.match(contents, /function validateInvariantEntry/);
  assert.doesNotMatch(contents, /Expression validation remains orchestrated from index\.js/);
});
