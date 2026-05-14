import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runImportAppWorkflow } from "../../src/import/index.js";
import { classifyImportSourcePath, findPrimaryImportFiles } from "../../src/import/core/shared.js";
import { buildCanonicalAdoptionOutputs } from "../../src/workflows/reconcile/adoption-plan.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const importFixtureRoot = path.join(repoRoot, "engine", "tests", "fixtures", "import");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");
const retainedImportFixtures = [
  "cli-basic",
  "docs-noise",
  "drizzle-basic",
  "prisma-openapi",
  "prisma-schema-only",
  "route-fallback",
  "sql-openapi",
  "ui-flows"
];

test("engine import fixtures are limited to actively tested smoke inputs", () => {
  const actual = fs.readdirSync(importFixtureRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(actual, retainedImportFixtures);
});

test("import source classification preserves runtime template paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-source-classification."));
  const paths = { repoRoot: root, workspaceRoot: root, topogramRoot: null };
  const runtimePaths = [
    "src/templates/email.ts",
    "src/templateRenderer.ts",
    "src/routes/templates.ts"
  ];
  for (const relativePath of runtimePaths) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "export const value = true;\n", "utf8");
    assert.equal(classifyImportSourcePath(paths, filePath), "runtime_source", relativePath);
  }

  const fixturePath = path.join(root, "swiftui-templates", "runtime", "GhostView.swift");
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, "struct GhostView {}\n", "utf8");
  assert.equal(classifyImportSourcePath(paths, fixturePath), "fixtures");

  const primaryFiles = findPrimaryImportFiles(paths, () => true)
    .map((filePath) => path.relative(root, filePath).replaceAll(path.sep, "/"))
    .sort();
  assert.deepEqual(primaryFiles, runtimePaths.sort());
});

test("reconcile adoption outputs reject topo path traversal from plan payloads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-containment."));
  const topogramRoot = path.join(root, "topo");
  fs.mkdirSync(path.join(topogramRoot, "candidates"), { recursive: true });
  fs.writeFileSync(path.join(root, "outside-source.tg"), "actor actor_outside {}\n", "utf8");

  const paths = { topogramRoot };
  assert.throws(
    () => buildCanonicalAdoptionOutputs(
      paths,
      {},
      [{
        bundle: "poisoned",
        kind: "actor",
        item: "actor_escape",
        canonical_rel_path: "../outside-target.tg",
        source_path: "candidates/actor_escape.tg"
      }],
      ["poisoned:actor:actor_escape"],
      {}
    ),
    /canonical_rel_path escapes the topo workspace/
  );
  assert.equal(fs.existsSync(path.join(root, "outside-target.tg")), false);

  assert.throws(
    () => buildCanonicalAdoptionOutputs(
      paths,
      {},
      [{
        bundle: "poisoned",
        kind: "actor",
        item: "actor_escape",
        canonical_rel_path: "actors/actor-escape.tg",
        source_path: "../outside-source.tg"
      }],
      ["poisoned:actor:actor_escape"],
      {}
    ),
    /source_path escapes the topo workspace/
  );
});

test("Prisma plus OpenAPI import fixture extracts DB and API candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "prisma-openapi"), {
    from: "db,api"
  }).summary;

  assert.deepEqual(summary.tracks, ["db", "api"]);
  assert.deepEqual(detectionIds(summary), ["api.openapi", "db.prisma"]);
  assert.deepEqual(candidateIds(summary.candidates.db.entities), ["entity_task", "entity_user"]);
  assert.deepEqual(candidateIds(summary.candidates.db.enums), ["task_priority"]);
  const seam = dbSeam(summary);
  assert.equal(seam.kind, "maintained_db_migration_seam");
  assert.equal(seam.tool, "prisma");
  assert.equal(seam.ownership, "maintained");
  assert.equal(seam.apply, "never");
  assert.equal(seam.confidence, "high");
  assert.equal(seam.schemaPath, "prisma/schema.prisma");
  assert.equal(seam.migrationsPath, "prisma/migrations");
  assert.equal(seam.snapshotPath, "topo/state/db/app_db/current.snapshot.json");
  assert.deepEqual(seam.missing_decisions, []);
  assert.deepEqual(seam.project_config_target, {
    file: "topogram.project.json",
    path: "topology.runtimes[id=app_db].migration",
    runtime_id: "app_db",
    projection_id: "proj_db"
  });
  assert.equal(seam.manual_next_steps.some((step) => step.includes("copy proposed_runtime_migration")), true);
  assert.deepEqual(seam.proposed_runtime_migration, {
    ownership: "maintained",
    tool: "prisma",
    apply: "never",
    snapshotPath: "topo/state/db/app_db/current.snapshot.json",
    schemaPath: "prisma/schema.prisma",
    migrationsPath: "prisma/migrations"
  });
  assert.deepEqual(candidateIds(summary.candidates.api.capabilities), ["cap_create_task", "cap_update_task"]);
});

test("SQL plus OpenAPI import fixture extracts DB and API candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "sql-openapi"), {
    from: "db,api"
  }).summary;

  assert.deepEqual(summary.tracks, ["db", "api"]);
  assert.deepEqual(detectionIds(summary), ["api.openapi", "db.sql"]);
  assert.deepEqual(candidateIds(summary.candidates.db.entities), ["entity_task", "entity_user"]);
  assert.deepEqual(candidateIds(summary.candidates.db.enums), ["task_priority"]);
  const seam = dbSeam(summary);
  assert.equal(seam.tool, "sql");
  assert.equal(seam.confidence, "high");
  assert.equal(seam.schemaPath, "db/schema.sql");
  assert.equal(seam.migrationsPath, "db/migrations");
  assert.equal(seam.proposed_runtime_migration.apply, "never");
  assert.deepEqual(candidateIds(summary.candidates.api.capabilities), ["cap_create_task", "cap_update_task"]);
});

test("Drizzle import fixture extracts maintained DB seam candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "drizzle-basic"), {
    from: "db"
  }).summary;

  assert.deepEqual(summary.tracks, ["db"]);
  assert.deepEqual(detectionIds(summary), ["db.drizzle"]);
  assert.deepEqual(candidateIds(summary.candidates.db.entities), ["entity_task"]);
  const seam = dbSeam(summary);
  assert.equal(seam.tool, "drizzle");
  assert.equal(seam.confidence, "high");
  assert.equal(seam.schemaPath, "src/db/schema.ts");
  assert.equal(seam.migrationsPath, "drizzle");
  assert.deepEqual(seam.match_reasons, [
    "found Drizzle schema source",
    "found Drizzle config",
    "found Drizzle migrations output"
  ]);
});

test("Prisma schema-only import reports an incomplete maintained DB seam candidate", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "prisma-schema-only"), {
    from: "db"
  }).summary;

  assert.deepEqual(summary.tracks, ["db"]);
  assert.deepEqual(detectionIds(summary), ["db.prisma"]);
  assert.deepEqual(candidateIds(summary.candidates.db.entities), ["entity_task"]);
  const seam = dbSeam(summary);
  assert.equal(seam.tool, "prisma");
  assert.equal(seam.confidence, "medium");
  assert.equal(seam.schemaPath, "prisma/schema.prisma");
  assert.equal(seam.migrationsPath, null);
  assert.equal(seam.missing_decisions.includes("confirm Prisma migrationsPath before adding this strategy to topogram.project.json"), true);
  assert.equal(Object.hasOwn(seam.proposed_runtime_migration, "migrationsPath"), false);
});

test("route fallback import fixture extracts API routes and React screens", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "route-fallback"), {
    from: "api,ui"
  }).summary;

  assert.deepEqual(summary.tracks, ["api", "ui"]);
  assert.deepEqual(detectionIds(summary), ["api.generic-route-fallback", "ui.react-router"]);
  assert.deepEqual(candidateIds(summary.candidates.api.capabilities), [
    "cap_create_task",
    "cap_list_tasks",
    "cap_update_task"
  ]);
  assert.deepEqual(candidateIds(summary.candidates.ui.screens), [
    "task_create",
    "task_detail",
    "task_edit",
    "task_list"
  ]);
  assert.deepEqual(candidateIds(summary.candidates.ui.widgets), [
    "widget_task_list_results"
  ]);
  assert.equal(Object.hasOwn(summary.candidates.ui, "components"), false);
});

test("CLI import fixture extracts command surface candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "cli-basic"), {
    from: "cli"
  }).summary;

  assert.deepEqual(summary.tracks, ["cli"]);
  assert.deepEqual(detectionIds(summary), ["cli.generic"]);
  assert.deepEqual((summary.candidates.cli.commands || []).map((item) => item.command_id).sort(), ["check", "import"]);
  assert.equal((summary.candidates.cli.commands || []).flatMap((item) => item.provenance || []).some((item) => item.includes("tests/cli.test.js")), false);
  assert.deepEqual(candidateIds(summary.candidates.cli.capabilities), ["cap_check", "cap_import"]);
  assert.deepEqual(candidateIds(summary.candidates.cli.surfaces), ["proj_cli_surface"]);
  const surface = summary.candidates.cli.surfaces[0];
  assert.deepEqual(surface.commands, ["check", "import"]);
  assert.deepEqual(
    (surface.options || []).map((item) => `${item.command_id}:${item.name}`).sort(),
    ["check:json", "import:from", "import:json", "import:out"]
  );
  assert.deepEqual(
    (surface.effects || []).map((item) => `${item.command_id}:${item.effect}`).sort(),
    ["check:read_only", "import:filesystem", "import:writes_workspace"]
  );
});

test("extractor commands list bundled manifests and check package-backed extractors", () => {
  const packageRoot = writeExtractorPackage(fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-package.")));

  const list = runCli(["extractor", "list", "--json"]);
  assert.equal(list.status, 0, list.stderr || list.stdout);
  const listPayload = JSON.parse(list.stdout);
  assert.equal(listPayload.summary.bundled >= 6, true);
  assert.equal(listPayload.summary.knownFirstParty >= 5, true);
  assert.equal(listPayload.summary.missingFirstParty >= 5, true);
  assert.equal(listPayload.reviewWorkflow.steps.some((item) => item.id === "dry_run_adoption"), true);
  assert.equal(listPayload.reviewWorkflow.safetyNotes.some((item) => item.includes("list/show/policy do not load")), true);
  assert.equal(listPayload.extractors.some((item) => item.id === "topogram/cli-extractors" && item.executesPackageCode === false), true);
  assert.equal(listPayload.groups.db.some((item) => item.package === "@topogram/extractor-prisma-db"), true);
  assert.equal(listPayload.groups.db.some((item) => item.package === "@topogram/extractor-drizzle-db"), true);
  assert.equal(listPayload.groups.api.some((item) => item.package === "@topogram/extractor-express-api"), true);
  assert.equal(listPayload.groups.ui.some((item) => item.package === "@topogram/extractor-react-router"), true);
  assert.equal(listPayload.groups.cli.some((item) => item.package === "@topogram/extractor-node-cli"), true);
  const prismaListItem = listPayload.extractors.find((item) => item.package === "@topogram/extractor-prisma-db");
  assert.equal(prismaListItem.knownFirstParty, true);
  assert.equal(prismaListItem.installed, false);
  assert.match(prismaListItem.installCommand, /npm install -D @topogram\/extractor-prisma-db/);
  assert.match(prismaListItem.policyPinCommand, /topogram extractor policy pin @topogram\/extractor-prisma-db@1/);
  assert.match(prismaListItem.extractCommand, /topogram extract \.\/prisma-app --out \.\/imported-topogram --from db --extractor @topogram\/extractor-prisma-db/);
  assert.equal(prismaListItem.reviewWorkflow.steps.some((item) => item.command === prismaListItem.extractCommand), true);

  const humanList = runCli(["extractor", "list"]);
  assert.equal(humanList.status, 0, humanList.stderr || humanList.stdout);
  assert.match(humanList.stdout, /Selection loop: list\/show \(no package code\) -> install -> policy pin -> extractor check/);

  const show = runCli(["extractor", "show", "topogram/cli-extractors", "--json"]);
  assert.equal(show.status, 0, show.stderr || show.stdout);
  const showPayload = JSON.parse(show.stdout);
  assert.equal(showPayload.extractor.id, "topogram/cli-extractors");
  assert.deepEqual(showPayload.extractor.tracks, ["cli"]);
  assert.equal(showPayload.extractor.reviewWorkflow.steps.some((item) => item.id === "check"), false);
  assert.equal(showPayload.extractor.reviewWorkflow.steps.some((item) => item.id === "extract"), true);

  const showFirstParty = runCli(["extractor", "show", "@topogram/extractor-prisma-db", "--json"]);
  assert.equal(showFirstParty.status, 0, showFirstParty.stderr || showFirstParty.stdout);
  const showFirstPartyPayload = JSON.parse(showFirstParty.stdout);
  assert.equal(showFirstPartyPayload.extractor.package, "@topogram/extractor-prisma-db");
  assert.equal(showFirstPartyPayload.extractor.installed, false);
  assert.equal(showFirstPartyPayload.extractor.executesPackageCode, false);
  assert.match(showFirstPartyPayload.extractor.useWhen, /Prisma/);
  assert.match(showFirstPartyPayload.extractor.installCommand, /npm install -D @topogram\/extractor-prisma-db/);
  assert.match(showFirstPartyPayload.extractor.policyPinCommand, /topogram extractor policy pin @topogram\/extractor-prisma-db@1/);
  assert.match(showFirstPartyPayload.extractor.extractCommand, /--from db --extractor @topogram\/extractor-prisma-db/);
  assert.equal(showFirstPartyPayload.extractor.reviewWorkflow.steps.some((item) => item.id === "check" && item.packageCodeExecution === true), true);

  const humanShow = runCli(["extractor", "show", "@topogram/extractor-prisma-db"]);
  assert.equal(humanShow.status, 0, humanShow.stderr || humanShow.stdout);
  assert.match(humanShow.stdout, /Review loop:/);
  assert.match(humanShow.stdout, /topogram adopt <selector> \.\/imported-topogram --dry-run/);

  const check = runCli(["extractor", "check", packageRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.equal(checkPayload.manifest.id, "@scope/extractor-cli-smoke");
  assert.equal(checkPayload.smoke.extractors, 1);
  assert.equal(checkPayload.reviewWorkflow.steps.some((item) => item.id === "review_plan"), true);

  const humanCheck = runCli(["extractor", "check", packageRoot]);
  assert.equal(humanCheck.status, 0, humanCheck.stderr || humanCheck.stdout);
  assert.match(humanCheck.stdout, /Next review loop:/);
  assert.match(humanCheck.stdout, /topogram extract plan \.\/imported-topogram/);
});

test("extractor check rejects unsafe package-backed candidate output", () => {
  const cases = [
    {
      name: "missing command identity",
      options: {
        candidateObjectSource: `{ commands: [{ label: "Missing Identity" }] }`
      },
      message: /candidates\.commands\[0\] must include an identity field: command_id or id_hint/
    },
    {
      name: "invalid bucket for track",
      options: {
        candidateObjectSource: `{ entities: [{ id_hint: "entity_wrong_track", name: "Wrong Track" }] }`
      },
      message: /candidates\.entities is not allowed for track 'cli'/
    },
    {
      name: "absolute source path",
      options: {
        candidateObjectSource: `{ commands: [{ command_id: "bad_path", label: "Bad Path", evidence: [{ file: "/tmp/source.js" }] }] }`
      },
      message: /candidates\.commands\[0\]\.evidence\[0\]\.file must be a safe project-relative path/
    },
    {
      name: "adoption-shaped bucket",
      options: {
        candidateObjectSource: `{ adoption_plan: [] }`
      },
      message: /candidates\.adoption_plan is not allowed/
    },
    {
      name: "canonical file write shape",
      options: {
        candidateObjectSource: `{ commands: [{ command_id: "writes_topo", label: "Writes Topo", files: { "topo/capabilities/cap-x.tg": "capability cap_x {}" } }] }`
      },
      message: /candidates\.commands\[0\]\.files is not allowed/
    }
  ];

  for (const entry of cases) {
    const packageRoot = writeExtractorPackage(fs.mkdtempSync(path.join(os.tmpdir(), `topogram-extractor-check-${entry.name.replaceAll(" ", "-")}.`)), entry.options);
    const check = runCli(["extractor", "check", packageRoot, "--json"]);
    assert.equal(check.status, 1, `${entry.name}: ${check.stderr || check.stdout}`);
    const payload = JSON.parse(check.stdout);
    assert.equal(payload.ok, false);
    assert.match(payload.errors.join("\n"), entry.message, entry.name);
  }
});

test("extractor scaffold creates a checkable package-backed extractor", () => {
  const packageRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-scaffold.")), "pack");
  const scaffold = runCli([
    "extractor",
    "scaffold",
    packageRoot,
    "--track",
    "cli",
    "--package",
    "@scope/topogram-extractor-scaffold",
    "--id",
    "@scope/extractor-scaffold",
    "--json"
  ]);
  assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);
  const payload = JSON.parse(scaffold.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.packageName, "@scope/topogram-extractor-scaffold");
  assert.equal(payload.manifestId, "@scope/extractor-scaffold");
  assert.equal(payload.track, "cli");
  assert.ok(payload.files.includes("topogram-extractor.json"));
  assert.ok(payload.files.includes("scripts/check-extractor.mjs"));
  assert.equal(fs.existsSync(path.join(packageRoot, "fixtures", "basic-source", "package.json")), true);

  const check = runCli(["extractor", "check", packageRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.equal(checkPayload.manifest.id, "@scope/extractor-scaffold");
  assert.equal(checkPayload.smoke.extractors, 1);
});

test("package-backed extractor policy gates execution before package code loads", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-policy."));
  const markerPath = path.join(runRoot, "loaded.txt");
  const packageRoot = writeExtractorPackage(path.join(runRoot, "extractor"), { markerPath });
  const targetRoot = path.join(runRoot, "imported");

  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "cli-basic"),
    "--out",
    targetRoot,
    "--from",
    "cli",
    "--extractor",
    packageRoot,
    "--json"
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Extractor package '@scope\/topogram-extractor-smoke' is not allowed/);
  assert.equal(fs.existsSync(markerPath), false);
});

test("package-backed extractors add review-only candidates and provenance when policy allows them", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-run."));
  const packageRoot = writeExtractorPackage(path.join(runRoot, "extractor"));
  const targetRoot = path.join(runRoot, "imported");
  const policyPath = path.join(runRoot, "topogram.extractor-policy.json");
  fs.writeFileSync(policyPath, `${JSON.stringify({
    version: "0.1",
    allowedPackageScopes: [],
    allowedPackages: ["@scope/topogram-extractor-smoke"],
    pinnedVersions: { "@scope/topogram-extractor-smoke": "1" },
    enabledPackages: []
  }, null, 2)}\n`, "utf8");

  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "cli-basic"),
    "--out",
    targetRoot,
    "--from",
    "cli",
    "--extractor",
    packageRoot,
    "--extractor-policy",
    policyPath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.candidateCounts.cliCommands, 3);
  const cliCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "cli", "candidates.json"), "utf8"));
  assert.equal(cliCandidates.commands.some((item) => item.command_id === "package_smoke"), true);
  const provenance = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-extract.json"), "utf8"));
  assert.equal(provenance.extract.extractorPackages.length, 1);
  assert.equal(provenance.extract.extractorPackages[0].packageName, "@scope/topogram-extractor-smoke");
  assert.deepEqual(provenance.extract.extractorPackages[0].extractors, ["cli.package-smoke"]);
});

test("package-backed extractors merge multiple tracks into one extraction review", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-combined."));
  const sourceRoot = path.join(runRoot, "source");
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "package.json"), "{\"name\":\"combined-package-extractor-source\",\"private\":true}\n", "utf8");

  const dbPackage = writeExtractorPackage(path.join(runRoot, "db-extractor"), {
    packageName: "@scope/topogram-extractor-db-smoke",
    manifestId: "@scope/extractor-db-smoke",
    track: "db",
    extractorId: "db.package-smoke",
    stack: { orm: "smoke-db" },
    capabilities: { schema: true, maintainedDbSeams: true },
    candidateKinds: ["entity", "maintained_db_migration_seam"],
    candidatesSource: JSON.stringify({
      entities: [{
        id_hint: "entity_package_task",
        name: "Package Task",
        source: "package",
        fields: [{ name: "id", type: "string", required: true }],
        evidence: ["package-backed DB extractor"],
        confidence: 0.91
      }],
      enums: [],
      relations: [],
      indexes: [],
      maintained_seams: [{
        kind: "maintained_db_migration_seam",
        id_hint: "seam_package_db_migrations",
        tool: "prisma",
        ownership: "maintained",
        apply: "never",
        schemaPath: "prisma/schema.prisma",
        migrationsPath: "prisma/migrations",
        snapshotPath: "topo/state/db/app_db/current.snapshot.json",
        runtime_id_hint: "app_db",
        projection_id_hint: "proj_db",
        confidence: "high",
        evidence: ["package-backed DB extractor"],
        match_reasons: ["package-backed DB extractor proposed a maintained seam"],
        missing_decisions: [],
        project_config_target: {
          file: "topogram.project.json",
          path: "topology.runtimes[id=app_db].migration",
          runtime_id: "app_db",
          projection_id: "proj_db"
        },
        manual_next_steps: ["Review and copy proposed_runtime_migration into topogram.project.json."],
        proposed_runtime_migration: {
          ownership: "maintained",
          tool: "prisma",
          apply: "never",
          snapshotPath: "topo/state/db/app_db/current.snapshot.json",
          schemaPath: "prisma/schema.prisma",
          migrationsPath: "prisma/migrations"
        }
      }]
    }, null, 2)
  });
  const apiPackage = writeExtractorPackage(path.join(runRoot, "api-extractor"), {
    packageName: "@scope/topogram-extractor-api-smoke",
    manifestId: "@scope/extractor-api-smoke",
    track: "api",
    extractorId: "api.package-smoke",
    stack: { runtime: "node", framework: "express-smoke" },
    capabilities: { routes: true },
    candidateKinds: ["capability", "route", "stack"],
    candidatesSource: JSON.stringify({
      capabilities: [{
        id_hint: "cap_list_package_tasks",
        name: "List Package Tasks",
        method: "GET",
        path: "/package-tasks",
        entity: "entity_package_task",
        inputs: [],
        evidence: ["package-backed API extractor"],
        confidence: 0.9
      }],
      routes: [{
        method: "GET",
        path: "/package-tasks",
        source_kind: "package",
        source: "package:@scope/topogram-extractor-api-smoke",
        capability: "cap_list_package_tasks",
        entity: "entity_package_task",
        evidence: ["package-backed API extractor"],
        confidence: 0.9
      }],
      stacks: [{
        id_hint: "stack_express_smoke",
        name: "Express Smoke API",
        framework: "express-smoke",
        runtime: "node",
        evidence: ["package-backed API extractor"],
        confidence: 0.8
      }]
    }, null, 2)
  });
  const targetRoot = path.join(runRoot, "imported");
  const policyPath = path.join(runRoot, "topogram.extractor-policy.json");
  fs.writeFileSync(policyPath, `${JSON.stringify({
    version: "0.1",
    allowedPackageScopes: [],
    allowedPackages: ["@scope/topogram-extractor-db-smoke", "@scope/topogram-extractor-api-smoke"],
    pinnedVersions: {
      "@scope/topogram-extractor-db-smoke": "1",
      "@scope/topogram-extractor-api-smoke": "1"
    },
    enabledPackages: []
  }, null, 2)}\n`, "utf8");

  const result = runCli([
    "extract",
    sourceRoot,
    "--out",
    targetRoot,
    "--from",
    "db,api",
    "--extractor",
    dbPackage,
    "--extractor",
    apiPackage,
    "--extractor-policy",
    policyPath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.candidateCounts.dbEntities, 1);
  assert.equal(payload.candidateCounts.dbMaintainedSeams, 1);
  assert.equal(payload.candidateCounts.apiCapabilities, 1);
  assert.equal(payload.candidateCounts.apiRoutes, 1);

  const dbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
  const apiCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "api", "candidates.json"), "utf8"));
  assert.deepEqual(candidateIds(dbCandidates.entities), ["entity_package_task"]);
  assert.equal(dbCandidates.maintained_seams[0].id_hint, "seam_package_db_migrations");
  assert.deepEqual(candidateIds(apiCandidates.capabilities), ["cap_list_package_tasks"]);
  assert.equal(apiCandidates.routes[0].path, "/package-tasks");

  const provenance = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-extract.json"), "utf8"));
  assert.deepEqual(
    provenance.extract.extractorPackages.map((entry) => entry.packageName).sort(),
    ["@scope/topogram-extractor-api-smoke", "@scope/topogram-extractor-db-smoke"]
  );
  assert.deepEqual(
    provenance.extract.extractorPackages.flatMap((entry) => entry.extractors).sort(),
    ["api.package-smoke", "db.package-smoke"]
  );
  assert.deepEqual(
    provenance.extract.extractorPackages.flatMap((entry) => entry.tracks).sort(),
    ["api", "db"]
  );

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.extractorContext.summary.package_backed_extractor_count, 2);
  assert.deepEqual(
    planPayload.extractorContext.packageBackedExtractors.map((entry) => entry.packageName).sort(),
    ["@scope/topogram-extractor-api-smoke", "@scope/topogram-extractor-db-smoke"]
  );
  const databaseBundle = planPayload.bundles.find((bundle) => bundle.bundle === "database");
  assert.equal(databaseBundle.extractorContext.packageBackedExtractors.length, 1);
  assert.equal(databaseBundle.extractorContext.packageBackedExtractors[0].packageName, "@scope/topogram-extractor-db-smoke");
  assert.equal(databaseBundle.extractorContext.safetyNotes.some((note) => note.includes("review candidates")), true);
  const packageTaskBundle = planPayload.bundles.find((bundle) => bundle.bundle === "package-task");
  assert.equal(
    packageTaskBundle.extractorContext.packageBackedExtractors.some((entry) => entry.packageName === "@scope/topogram-extractor-api-smoke"),
    true
  );
  const humanPlan = runCli(["extract", "plan", targetRoot]);
  assert.equal(humanPlan.status, 0, humanPlan.stderr || humanPlan.stdout);
  assert.match(humanPlan.stdout, /Extractors: @scope\/topogram-extractor-db-smoke/);
  assert.match(humanPlan.stdout, /package-backed extractor candidates are review-only/);
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  assert.equal(adoptionPlan.imported_maintained_db_seam_candidates.length, 1);
  assert.equal(
    adoptionPlan.imported_proposal_surfaces.some((item) => item.kind === "capability" && item.item === "cap_list_package_tasks"),
    true
  );
  assert.equal(
    adoptionPlan.imported_proposal_surfaces.some((item) => item.kind === "maintained_db_migration_seam" && item.item === "seam_package_db_migrations"),
    true
  );

  const extractPlanQuery = runCli(["query", "extract-plan", targetRoot, "--json"]);
  assert.equal(extractPlanQuery.status, 0, extractPlanQuery.stderr || extractPlanQuery.stdout);
  const extractPlanPayload = JSON.parse(extractPlanQuery.stdout);
  assert.equal(extractPlanPayload.extraction_context.summary.package_backed_extractor_count, 2);
  assert.deepEqual(
    extractPlanPayload.extraction_context.package_backed_extractors.map((entry) => entry.packageName).sort(),
    ["@scope/topogram-extractor-api-smoke", "@scope/topogram-extractor-db-smoke"]
  );
  assert.equal(extractPlanPayload.extraction_context.candidate_counts.dbMaintainedSeams, 1);
  assert.equal(extractPlanPayload.extraction_context.next_commands.includes("topogram adopt <selector> --dry-run"), true);

  const singleAgentPlan = runCli(["query", "single-agent-plan", targetRoot, "--mode", "extract-adopt", "--json"]);
  assert.equal(singleAgentPlan.status, 0, singleAgentPlan.stderr || singleAgentPlan.stdout);
  const singleAgentPayload = JSON.parse(singleAgentPlan.stdout);
  assert.equal(singleAgentPayload.extraction_context.summary.package_backed_extractor_count, 2);
  assert.equal(singleAgentPayload.resolved_workflow_context.extraction_context.summary.package_backed_extractor_count, 2);

  const multiAgentPlan = runCli(["query", "multi-agent-plan", targetRoot, "--mode", "extract-adopt", "--json"]);
  assert.equal(multiAgentPlan.status, 0, multiAgentPlan.stderr || multiAgentPlan.stdout);
  const multiAgentPayload = JSON.parse(multiAgentPlan.stdout);
  assert.equal(multiAgentPayload.extraction_context.summary.package_backed_extractor_count, 2);

  const adoptionWorkPacket = runCli(["query", "work-packet", targetRoot, "--mode", "extract-adopt", "--lane", "adoption_operator", "--json"]);
  assert.equal(adoptionWorkPacket.status, 0, adoptionWorkPacket.stderr || adoptionWorkPacket.stdout);
  const adoptionWorkPacketPayload = JSON.parse(adoptionWorkPacket.stdout);
  assert.equal(adoptionWorkPacketPayload.extraction_context.summary.package_backed_extractor_count, 2);
  assert.equal(adoptionWorkPacketPayload.summary.canonical_writer, true);

  const selectorList = runCli(["adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "entities"), true);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "capabilities"), true);
  assert.equal(selectorPayload.selectors.some((selector) => selector.selector === "bundle:database"), true);
  assert.equal(selectorPayload.selectors.some((selector) => selector.selector === "bundle:package-task"), true);
  const databaseSelector = selectorPayload.selectors.find((selector) => selector.selector === "bundle:database");
  assert.equal(databaseSelector.extractorContext.packageBackedExtractors[0].packageName, "@scope/topogram-extractor-db-smoke");
  const packageTaskSelector = selectorPayload.selectors.find((selector) => selector.selector === "bundle:package-task");
  assert.equal(
    packageTaskSelector.extractorContext.packageBackedExtractors.some((entry) => entry.packageName === "@scope/topogram-extractor-api-smoke"),
    true
  );
  const humanSelectorList = runCli(["adopt", "--list", targetRoot]);
  assert.equal(humanSelectorList.status, 0, humanSelectorList.stderr || humanSelectorList.stdout);
  assert.match(humanSelectorList.stdout, /Extractors: @scope\/topogram-extractor-db-smoke/);
  assert.match(humanSelectorList.stdout, /package-backed extractor candidates are review-only/);

  const databasePreview = runCli(["adopt", "bundle:database", targetRoot, "--dry-run", "--json"]);
  assert.equal(databasePreview.status, 0, databasePreview.stderr || databasePreview.stdout);
  const databasePreviewPayload = JSON.parse(databasePreview.stdout);
  assert.equal(databasePreviewPayload.dryRun, true);
  assert.deepEqual(databasePreviewPayload.writtenFiles, []);
  assert.equal(
    fs.readFileSync(path.join(targetRoot, "topogram.project.json"), "utf8").includes("proposed_runtime_migration"),
    false
  );

  const packageTaskPreview = runCli(["adopt", "bundle:package-task", targetRoot, "--dry-run", "--json"]);
  assert.equal(packageTaskPreview.status, 0, packageTaskPreview.stderr || packageTaskPreview.stdout);
  const packageTaskPreviewPayload = JSON.parse(packageTaskPreview.stdout);
  assert.equal(packageTaskPreviewPayload.dryRun, true);
  assert.equal(packageTaskPreviewPayload.promotedCanonicalItemCount >= 2, true);
  assert.deepEqual(packageTaskPreviewPayload.writtenFiles, []);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-package-task.tg")), false);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-adoptions.jsonl")), false);

  const packageTaskWrite = runCli(["adopt", "bundle:package-task", targetRoot, "--write", "--json"]);
  assert.equal(packageTaskWrite.status, 0, packageTaskWrite.stderr || packageTaskWrite.stdout);
  const packageTaskWritePayload = JSON.parse(packageTaskWrite.stdout);
  assert.equal(packageTaskWritePayload.dryRun, false);
  assert.equal(packageTaskWritePayload.write, true);
  assert.equal(packageTaskWritePayload.receipt.selector, "bundle:package-task");
  assert.equal(packageTaskWritePayload.receipt.sourceProvenance.status, "clean");
  assert.equal(packageTaskWritePayload.writtenFiles.includes("entities/entity-package-task.tg"), true);
  assert.equal(packageTaskWritePayload.writtenFiles.includes("capabilities/cap-list-package-tasks.tg"), true);
  assert.equal(
    packageTaskWritePayload.receipt.writtenFileHashes.some((item) => item.path === "entities/entity-package-task.tg" && item.sha256),
    true
  );
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-package-task.tg")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "capabilities", "cap-list-package-tasks.tg")), true);
  assert.equal(
    fs.readFileSync(path.join(targetRoot, "topogram.project.json"), "utf8").includes("proposed_runtime_migration"),
    false
  );
});

test("package-backed extractors reject malformed candidate output during extraction", () => {
  const cases = [
    {
      name: "non-array bucket",
      options: { malformedCandidates: true },
      message: /Extractor 'cli\.package-smoke' extract\(context\) candidates\.commands must be an array/
    },
    {
      name: "missing identity",
      options: {
        candidateObjectSource: `{ commands: [{ label: "Missing Identity" }] }`
      },
      message: /Extractor 'cli\.package-smoke' extract\(context\) candidates\.commands\[0\] must include an identity field: command_id or id_hint/
    },
    {
      name: "invalid track bucket",
      options: {
        candidateObjectSource: `{ entities: [{ id_hint: "entity_wrong_track", name: "Wrong Track" }] }`
      },
      message: /Extractor 'cli\.package-smoke' extract\(context\) candidates\.entities is not allowed for track 'cli'/
    },
    {
      name: "absolute source path",
      options: {
        candidateObjectSource: `{ commands: [{ command_id: "bad_path", label: "Bad Path", evidence: [{ file: "/tmp/source.js" }] }] }`
      },
      message: /Extractor 'cli\.package-smoke' extract\(context\) candidates\.commands\[0\]\.evidence\[0\]\.file must be a safe project-relative path/
    },
    {
      name: "adoption shaped output",
      options: {
        candidateObjectSource: `{ adoption_plan: [] }`
      },
      message: /Extractor 'cli\.package-smoke' extract\(context\) candidates\.adoption_plan is not allowed/
    },
    {
      name: "topo write output",
      options: {
        candidateObjectSource: `{ commands: [{ command_id: "writes_topo", label: "Writes Topo", files: { "topo/capabilities/cap-x.tg": "capability cap_x {}" } }] }`
      },
      message: /Extractor 'cli\.package-smoke' extract\(context\) candidates\.commands\[0\]\.files is not allowed/
    }
  ];

  for (const entry of cases) {
    const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), `topogram-extractor-bad-output-${entry.name.replaceAll(" ", "-")}.`));
    const packageRoot = writeExtractorPackage(path.join(runRoot, "extractor"), entry.options);
    const targetRoot = path.join(runRoot, "imported");
    const policyPath = path.join(runRoot, "topogram.extractor-policy.json");
    fs.writeFileSync(policyPath, `${JSON.stringify({
      version: "0.1",
      allowedPackageScopes: [],
      allowedPackages: ["@scope/topogram-extractor-smoke"],
      pinnedVersions: { "@scope/topogram-extractor-smoke": "1" },
      enabledPackages: []
    }, null, 2)}\n`, "utf8");

    const result = runCli([
      "extract",
      path.join(importFixtureRoot, "cli-basic"),
      "--out",
      targetRoot,
      "--from",
      "cli",
      "--extractor",
      packageRoot,
      "--extractor-policy",
      policyPath,
      "--json"
    ]);

    assert.equal(result.status, 1, `${entry.name}: ${result.stderr || result.stdout}`);
    assert.match(result.stderr, entry.message, entry.name);
  }
});

test("extractor policy commands initialize, pin, and report enabled packages", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-policy-cli."));
  fs.writeFileSync(path.join(runRoot, "package.json"), "{\"devDependencies\":{\"@scope/topogram-extractor-smoke\":\"1.0.0\"}}\n", "utf8");

  const init = runCli(["extractor", "policy", "init", runRoot, "--json"]);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  assert.equal(fs.existsSync(path.join(runRoot, "topogram.extractor-policy.json")), true);

  const pin = runCli(["extractor", "policy", "pin", "@scope/topogram-extractor-smoke@1", runRoot, "--json"]);
  assert.equal(pin.status, 0, pin.stderr || pin.stdout);
  const policy = JSON.parse(fs.readFileSync(path.join(runRoot, "topogram.extractor-policy.json"), "utf8"));
  assert.deepEqual(policy.enabledPackages, ["@scope/topogram-extractor-smoke"]);
  assert.equal(policy.pinnedVersions["@scope/topogram-extractor-smoke"], "1");

  const status = runCli(["extractor", "policy", "status", runRoot, "--json"]);
  assert.equal(status.status, 1);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.summary.enabledPackages, 1);
  assert.equal(statusPayload.packages[0].packageName, "@scope/topogram-extractor-smoke");
  assert.equal(statusPayload.packages[0].installed, false);
  assert.equal(statusPayload.reviewWorkflow.steps.some((item) => item.id === "check"), true);

  const humanStatus = runCli(["extractor", "policy", "status", runRoot]);
  assert.equal(humanStatus.status, 1);
  assert.match(humanStatus.stdout, /Review loop: install package -> pin policy -> extractor check -> extract -> extract plan\/adopt --list/);
});

test("docs, tests, and fixture snippets do not create primary import candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "docs-noise"), {
    from: "db,api,ui,cli"
  }).summary;

  assert.deepEqual(summary.tracks, ["db", "api", "ui", "cli"]);
  assert.deepEqual(detectionIds(summary), []);
  assert.deepEqual(summary.candidates.db.entities, []);
  assert.deepEqual(summary.candidates.db.maintained_seams, []);
  assert.deepEqual(summary.candidates.api.capabilities, []);
  assert.deepEqual(summary.candidates.api.routes, []);
  assert.deepEqual(summary.candidates.ui.screens, []);
  assert.deepEqual(summary.candidates.ui.flows, []);
  assert.deepEqual(summary.candidates.cli.commands, []);
  assert.deepEqual(summary.candidates.cli.surfaces, []);
});

test("non-resource UI routes emit review-only flow candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "ui-flows"), {
    from: "ui"
  }).summary;

  assert.deepEqual(summary.tracks, ["ui"]);
  assert.deepEqual(detectionIds(summary), ["ui.react-router"]);
  assert.deepEqual(candidateIds(summary.candidates.ui.flows), [
    "flow_approvals_review",
    "flow_dashboard",
    "flow_login",
    "flow_onboarding_setup",
    "flow_search",
    "flow_settings_profile"
  ]);
  const flow = summary.candidates.ui.flows.find((item) => item.flow_type === "auth");
  assert.equal(flow.kind, "ui_flow");
  assert.equal(flow.confidence, "medium");
  assert.deepEqual(flow.route_paths, ["/login"]);
  assert.deepEqual(flow.screen_ids, ["login"]);
  assert.equal(flow.proposed_ui_contract_additions.projection_type, "ui_contract");
  assert.equal(flow.missing_decisions.includes("confirm auth provider and session lifecycle"), true);
});

test("brownfield UI flow candidates are carried into import plan and adoption review", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-flows."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "ui-flows"),
    "--out",
    targetRoot,
    "--from",
    "ui",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.candidateCounts.uiFlows, 6);
  const uiCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "ui", "candidates.json"), "utf8"));
  assert.equal(uiCandidates.flows.length, 6);
  assert.equal(uiCandidates.flows[0].kind, "ui_flow");
  const uiReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "ui", "report.md"), "utf8");
  assert.match(uiReport, /Flow candidates: 6/);
  assert.match(uiReport, /## Flow Candidates/);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.summary.proposalItemCount, 18);
  assert.equal(planPayload.bundles.every((bundle) => bundle.kindCounts.ui === 2), true);
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  const flowSurface = adoptionPlan.imported_proposal_surfaces.find((item) => item.item === "ui_flow_flow_login");
  assert.equal(flowSurface.kind, "ui");
  assert.equal(flowSurface.track, "ui");
  assert.equal(flowSurface.source_path, "candidates/reconcile/model/bundles/flow-auth/docs/reports/ui-flow-flow_login.md");
  assert.equal(flowSurface.canonical_rel_path, "docs/reports/ui-flow-flow_login.md");
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "docs", "reports", "ui-flow-flow_login.md")), false);

  const selectorList = runCli(["adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  const uiSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "ui");
  assert.equal(uiSelector.itemCount, 12);
});

test("brownfield import creates editable Topogram workspace with source provenance", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-workspace."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "sql-openapi"),
    "--out",
    targetRoot,
    "--from",
    "db,api",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.tracks, ["db", "api"]);
  assert.equal(payload.candidateCounts.dbEntities, 2);
  assert.equal(payload.candidateCounts.dbMaintainedSeams, 1);
  assert.equal(payload.candidateCounts.apiCapabilities, 2);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-extract.json")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "app", "report.md")), true);
  const dbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
  assert.equal(dbCandidates.maintained_seams.length, 1);
  assert.equal(dbCandidates.maintained_seams[0].proposed_runtime_migration.tool, "sql");
  assert.equal(dbCandidates.maintained_seams[0].manual_next_steps.some((step) => step.includes("topogram.project.json")), true);
  assert.equal(dbCandidates.maintained_seams[0].apply, "never");
  const dbReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "report.md"), "utf8");
  assert.match(dbReport, /Maintained DB migration seams: 1/);
  assert.match(dbReport, /seam_sql_db_migrations/);
  assert.match(dbReport, /project config target/);
  assert.match(dbReport, /manual next:/);
  const appReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "report.md"), "utf8");
  assert.match(appReport, /Maintained DB migration seams: 1/);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(targetRoot, "topogram.project.json"), "utf8"));
  assert.equal(JSON.stringify(projectConfig).includes("proposed_runtime_migration"), false);
  assert.equal(JSON.stringify(projectConfig).includes("migrationsPath"), false);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "entities", "entity_task.tg")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "database", "README.md")), true);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.bundles[0].bundle, "database");
  assert.equal(planPayload.bundles[0].kindCounts.maintained_db_migration_seam, 1);
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  assert.equal(adoptionPlan.imported_maintained_db_seam_candidates.length, 1);
  const dbSeamSurface = adoptionPlan.imported_proposal_surfaces.find((item) => item.kind === "maintained_db_migration_seam");
  assert.equal(dbSeamSurface.bundle, "database");
  assert.equal(dbSeamSurface.recommended_state, "customize");
  assert.equal(dbSeamSurface.maintained_seam_candidates[0].tool, "sql");
  assert.equal(dbSeamSurface.mapping_suggestions[0].project_config_target.path, "topology.runtimes[id=app_db].migration");
  assert.equal(dbSeamSurface.mapping_suggestions[0].manual_next_steps.some((step) => step.includes("copy proposed_runtime_migration")), true);
  const reconcileReport = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.json"), "utf8"));
  const databaseBundle = reconcileReport.candidate_model_bundles.find((bundle) => bundle.slug === "database");
  assert.equal(databaseBundle.maintained_seam_candidates[0].id, "seam_sql_db_migrations");
  const databaseReadme = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "database", "README.md"), "utf8");
  assert.match(databaseReadme, /proposed runtime migration/);
  assert.match(databaseReadme, /manual next:/);

  const check = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.equal(checkPayload.extract.status, "clean");
  assert.equal(checkPayload.topogram.ok, true);

  fs.appendFileSync(
    path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "README.md"),
    "\nLocal review note.\n"
  );
  const editedCheck = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(editedCheck.status, 0, editedCheck.stderr || editedCheck.stdout);
  assert.equal(JSON.parse(editedCheck.stdout).extract.status, "clean");
});

test("brownfield CLI import writes reviewable command surface and adopts canonical projection", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-cli."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "cli-basic"),
    "--out",
    targetRoot,
    "--from",
    "cli",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.tracks, ["cli"]);
  assert.equal(payload.candidateCounts.cliCommands, 2);
  assert.equal(payload.candidateCounts.cliCapabilities, 2);
  assert.equal(payload.candidateCounts.cliSurfaces, 1);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "app", "cli", "report.md")), true);

  const candidateProjectionPath = path.join(
    targetRoot,
    "topo",
    "candidates",
    "reconcile",
    "model",
    "bundles",
    "cli",
    "projections",
    "proj_cli_surface.tg"
  );
  assert.equal(fs.existsSync(candidateProjectionPath), true);
  const candidateProjection = fs.readFileSync(candidateProjectionPath, "utf8");
  assert.match(candidateProjection, /type cli_surface/);
  assert.match(candidateProjection, /command check capability cap_check/);
  assert.match(candidateProjection, /command import capability cap_import/);
  assert.match(candidateProjection, /command import effect writes_workspace/);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.summary.proposalItemCount, 4);
  assert.deepEqual(planPayload.bundles[0].kindCounts, {
    capability: 2,
    doc: 1,
    projection: 1
  });

  const selectorList = runCli(["adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  const cliSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "cli");
  assert.equal(cliSelector.itemCount, 4);

  const adopt = runCli(["adopt", "cli", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "projection" && item.item === "proj_cli_surface"), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "projections", "proj-cli-surface.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("brownfield UI import writes reviewable widget candidates and shared bindings", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-components."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.candidateCounts.uiWidgets, 1);
  assert.equal(payload.candidateCounts.uiShapes, 1);
  assert.equal(Object.hasOwn(payload.candidateCounts, "uiComponents"), false);

  const uiCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "ui", "candidates.json"), "utf8"));
  assert.equal(Object.hasOwn(uiCandidates, "components"), false);
  const widgetCandidate = uiCandidates.widgets[0];
  assert.equal(widgetCandidate.id_hint, "widget_task_list_results");
  assert.equal(widgetCandidate.inferred_region, "results");
  assert.equal(widgetCandidate.inferred_pattern, "search_results");
  assert.deepEqual(widgetCandidate.inferred_props, [
    { name: "rows", type: "array", required: true, source: "cap_list_tasks" }
  ]);
  assert.deepEqual(widgetCandidate.inferred_events, [
    {
      name: "row_select",
      kind: "selection",
      action: "navigate",
      target_screen: "task_detail",
      payload_shape: "shape_event_task_row_select",
      confidence: "medium",
      evidence: [
        "engine/tests/fixtures/import/route-fallback/apps/web/src/App.tsx#/tasks/:id"
      ],
      payload_fields: [
        { name: "id", field_type: "string", required: true }
      ],
      requires_payload_shape_review: true
    }
  ]);
  assert.deepEqual(uiCandidates.shapes.map((shape) => shape.id_hint), ["shape_event_task_row_select"]);
  assert.deepEqual(uiCandidates.shapes[0].fields, [
    { name: "id", field_type: "string", required: true }
  ]);
  assert.equal(widgetCandidate.missing_decisions.includes("confirm supported regions and patterns"), true);
  assert.equal((widgetCandidate.evidence || []).length > 0, true);

  const sharedDraftPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "drafts", "proj-ui-contract.tg");
  const componentDraftPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "drafts", "widgets", "widget-task-list-results.tg");
  const shapeDraftPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "drafts", "shapes", "shape-event-task-row-select.tg");
  assert.equal(fs.existsSync(sharedDraftPath), true);
  assert.equal(fs.existsSync(componentDraftPath), true);
  assert.equal(fs.existsSync(shapeDraftPath), true);

  const sharedDraft = fs.readFileSync(sharedDraftPath, "utf8");
  assert.match(sharedDraft, /type ui_contract/);
  assert.match(sharedDraft, /design_tokens \{/);
  assert.match(sharedDraft, /widget_bindings \{/);
  assert.match(sharedDraft, /screen task_list region results widget widget_task_list_results data rows from cap_list_tasks event row_select navigate task_detail/);
  assert.doesNotMatch(sharedDraft, /\[object Object\]/);

  const componentDraft = fs.readFileSync(componentDraftPath, "utf8");
  assert.match(componentDraft, /# Import metadata: confidence low; evidence \d+; inferred pattern search_results; inferred region results\./);
  assert.match(componentDraft, /# Missing decisions: confirm widget reuse boundary; confirm prop names and data source; confirm events and behavior; confirm supported regions and patterns\./);
  assert.match(componentDraft, /# Inferred event: row_select navigate task_detail; review payload shape shape_event_task_row_select\./);
  assert.match(componentDraft, /# Event declarations are draft bindings and require payload shape review before adoption\./);
  assert.match(componentDraft, /widget widget_task_list_results \{/);
  assert.match(componentDraft, /events \{\n    row_select shape_event_task_row_select\n  \}/);
  assert.match(componentDraft, /selection mode single emits row_select/);
  assert.match(componentDraft, /patterns \[search_results\]/);
  assert.match(componentDraft, /status proposed/);

  const shapeDraft = fs.readFileSync(shapeDraftPath, "utf8");
  assert.match(shapeDraft, /shape shape_event_task_row_select \{/);
  assert.match(shapeDraft, /id string required/);

  const uiReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "ui", "report.md"), "utf8");
  assert.match(uiReport, /Event payload shapes: 1/);
  assert.match(uiReport, /## Widget Candidates/);
  assert.match(uiReport, /`widget_task_list_results` confidence low pattern `search_results` region `results` events 1 evidence \d+ missing decisions 4/);
  assert.match(uiReport, /topogram widget check <path>/);
  assert.match(uiReport, /topogram widget behavior <path>/);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.summary.proposalItemCount, 10);
  assert.deepEqual(planPayload.bundles[0].kindCounts, {
    capability: 3,
    shape: 1,
    widget: 1,
    doc: 1,
    ui: 4
  });
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  const widgetItems = adoptionPlan.imported_proposal_surfaces.filter((item) => item.kind === "widget");
  assert.deepEqual(widgetItems.map((item) => item.item), ["widget_task_list_results"]);
  assert.deepEqual(widgetItems[0].related_shapes, ["shape_event_task_row_select"]);
  assert.equal(widgetItems[0].source_path, "candidates/reconcile/model/bundles/task/widgets/widget_task_list_results.tg");
  assert.equal(widgetItems[0].canonical_rel_path, "widgets/widget-task-list-results.tg");
  const reconcileReportJson = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.json"), "utf8"));
  const taskBundle = reconcileReportJson.candidate_model_bundles.find((bundle) => bundle.slug === "task");
  assert.deepEqual(taskBundle.shapes, ["shape_event_task_row_select"]);
  assert.deepEqual(taskBundle.widgets, ["widget_task_list_results"]);
  assert.equal(Object.hasOwn(taskBundle, "components"), false);
  assert.deepEqual(taskBundle.operator_summary.widgetIds, ["widget_task_list_results"]);
  assert.equal(Object.hasOwn(taskBundle.operator_summary, "componentIds"), false);
  const reconcileReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.md"), "utf8");
  assert.match(reconcileReport, /1 widgets/);
  assert.match(reconcileReport, /main widgets `widget_task_list_results`/);
  const bundleReadme = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "README.md"), "utf8");
  assert.match(bundleReadme, /Widgets: 1/);
  assert.match(bundleReadme, /Main widgets: `widget_task_list_results`/);
  const bundleShape = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "shapes", "shape_event_task_row_select.tg"), "utf8");
  assert.match(bundleShape, /shape shape_event_task_row_select \{/);
  assert.match(bundleShape, /id string required/);
  const bundleWidget = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "widgets", "widget_task_list_results.tg"), "utf8");
  assert.match(bundleWidget, /# Inferred event: row_select navigate task_detail\./);
  assert.match(bundleWidget, /events \{\n    row_select shape_event_task_row_select\n  \}/);

  const selectorList = runCli(["adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  const widgetSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "widgets");
  assert.equal(widgetSelector.itemCount, 1);
  assert.match(widgetSelector.previewCommand, /topogram adopt widgets .* --dry-run/);
  assert.match(widgetSelector.writeCommand, /topogram adopt widgets .* --write/);
  const uiSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "ui");
  assert.equal(uiSelector.itemCount, 6);
  assert.match(uiSelector.label, /UI reports, widgets, and event shapes/);

  const humanSelectorList = runCli(["adopt", "--list", targetRoot]);
  assert.equal(humanSelectorList.status, 0, humanSelectorList.stderr || humanSelectorList.stdout);
  assert.match(humanSelectorList.stdout, /Broad selectors:/);
  assert.match(humanSelectorList.stdout, /widgets: 1 widgets/);

  const adopt = runCli(["adopt", "widgets", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItemCount, 2);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "shape" && item.item === "shape_event_task_row_select"), true);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "widget" && item.item === "widget_task_list_results"), true);
  assert.equal(adoptPayload.receipt.writtenFileHashes.some((item) => item.path === "shapes/shape-event-task-row-select.tg" && item.sha256 && item.size > 0), true);
  assert.equal(adoptPayload.receipt.writtenFileHashes.some((item) => item.path === "widgets/widget-task-list-results.tg" && item.sha256 && item.size > 0), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "shapes", "shape-event-task-row-select.tg")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "widgets", "widget-task-list-results.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const status = runCli(["extract", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).adoption.summary.appliedItemCount, 2);
});

test("brownfield UI broad selector promotes widgets and related event payload shapes", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-selector."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const adopt = runCli(["adopt", "ui", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "shape" && item.item === "shape_event_task_row_select"), true);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "widget" && item.item === "widget_task_list_results"), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "shapes", "shape-event-task-row-select.tg")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "widgets", "widget-task-list-results.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const status = runCli(["extract", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).adoption.summary.appliedItemCount, 6);
});

test("brownfield import workflow keeps project-owned files under topo workspace", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-topo-workflow."));
  const targetRoot = path.join(runRoot, "imported");
  const sourceRoot = path.join(importFixtureRoot, "route-fallback");
  const topoRoot = path.join(targetRoot, "topo");

  const result = runCli([
    "extract",
    sourceRoot,
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.workspaceRoot, topoRoot);
  assert.equal(payload.topogramRoot, topoRoot);
  assert.equal(fs.existsSync(path.join(topoRoot, "candidates", "app", "ui", "candidates.json")), true);
  assert.equal(fs.existsSync(path.join(topoRoot, "candidates", "reconcile", "adoption-plan.agent.json")), true);
  assertNoLegacyTopogramWorkspace(targetRoot);
  assert.equal(payload.writtenFiles.every((filePath) => filePath === "topogram.project.json" || !filePath.startsWith("topogram/")), true);

  const check = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.workspaceRoot, topoRoot);
  assert.equal(checkPayload.extract.status, "clean");

  const diff = runCli(["extract", "diff", targetRoot, "--json"]);
  assert.equal(diff.status, 0, diff.stderr || diff.stdout);
  const diffPayload = JSON.parse(diff.stdout);
  assert.equal(diffPayload.ok, true);
  assert.equal(diffPayload.workspaceRoot, topoRoot);
  assert.equal(diffPayload.topogramRoot, topoRoot);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.ok, true);
  assert.equal(planPayload.workspaceRoot, topoRoot);
  assert.equal(planPayload.topogramRoot, topoRoot);
  assert.equal(planPayload.summary.proposalItemCount > 0, true);

  const selectorList = runCli(["adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  assert.equal(selectorPayload.workspaceRoot, topoRoot);
  assert.equal(selectorPayload.topogramRoot, topoRoot);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "widgets"), true);

  const preview = runCli(["adopt", "widgets", targetRoot, "--dry-run", "--json"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const previewPayload = JSON.parse(preview.stdout);
  assert.equal(previewPayload.dryRun, true);
  assert.equal(previewPayload.workspaceRoot, topoRoot);
  assert.equal(previewPayload.topogramRoot, topoRoot);
  assert.deepEqual(previewPayload.writtenFiles, []);
  assert.equal(fs.existsSync(path.join(topoRoot, "widgets")), false);

  const write = runCli(["adopt", "widgets", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const writePayload = JSON.parse(write.stdout);
  assert.equal(writePayload.workspaceRoot, topoRoot);
  assert.equal(writePayload.topogramRoot, topoRoot);
  assert.equal(writePayload.receipt.workspaceRoot, topoRoot);
  assert.equal(writePayload.receipt.topogramRoot, topoRoot);
  assert.equal(writePayload.receipt.selector, "widgets");
  assert.equal(fs.existsSync(path.join(topoRoot, "widgets", "widget-task-list-results.tg")), true);
  assert.equal(writePayload.writtenFiles.every((filePath) => !filePath.startsWith("topogram/")), true);
  assertNoLegacyTopogramWorkspace(targetRoot);

  const status = runCli(["extract", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.workspaceRoot, topoRoot);
  assert.equal(statusPayload.topogramRoot, topoRoot);
  assert.equal(statusPayload.extract.status, "clean");
  assert.equal(statusPayload.adoption.summary.appliedItemCount, 2);

  const history = runCli(["extract", "history", targetRoot, "--verify", "--json"]);
  assert.equal(history.status, 0, history.stderr || history.stdout);
  const historyPayload = JSON.parse(history.stdout);
  assert.equal(historyPayload.workspaceRoot, topoRoot);
  assert.equal(historyPayload.verified, true);
  assert.equal(historyPayload.summary.receiptCount, 1);
  assert.deepEqual(historyPayload.entries, historyPayload.receipts);
  assert.equal(historyPayload.receipts[0].selector, "widgets");
  assert.equal(historyPayload.verification.status, "matched");

  const dryRefresh = runCli(["extract", "refresh", "--from", sourceRoot, targetRoot, "--dry-run", "--json"]);
  assert.equal(dryRefresh.status, 0, dryRefresh.stderr || dryRefresh.stdout);
  const dryRefreshPayload = JSON.parse(dryRefresh.stdout);
  assert.equal(dryRefreshPayload.dryRun, true);
  assert.equal(dryRefreshPayload.workspaceRoot, topoRoot);
  assert.equal(dryRefreshPayload.topogramRoot, topoRoot);
  assert.deepEqual(dryRefreshPayload.writtenFiles, []);

  const refresh = runCli(["extract", "refresh", "--from", sourceRoot, targetRoot, "--json"]);
  assert.equal(refresh.status, 0, refresh.stderr || refresh.stdout);
  const refreshPayload = JSON.parse(refresh.stdout);
  assert.equal(refreshPayload.ok, true);
  assert.equal(refreshPayload.workspaceRoot, topoRoot);
  assert.equal(refreshPayload.topogramRoot, topoRoot);
  assert.equal(refreshPayload.currentExtractStatus, "clean");
  assert.equal(refreshPayload.writtenFiles.every((filePath) => filePath === "topogram.project.json" || !filePath.startsWith("topogram/")), true);
  assertNoLegacyTopogramWorkspace(targetRoot);
});

test("legacy imported UI component candidates are read as widgets without rewriting public reports", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-legacy-components."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "extract",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const uiCandidatesPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "candidates.json");
  const uiCandidates = JSON.parse(fs.readFileSync(uiCandidatesPath, "utf8"));
  const legacyUiCandidates = {
    ...uiCandidates,
    components: uiCandidates.widgets
  };
  delete legacyUiCandidates.widgets;
  fs.writeFileSync(uiCandidatesPath, `${JSON.stringify(legacyUiCandidates, null, 2)}\n`);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  const widgetItems = adoptionPlan.imported_proposal_surfaces.filter((item) => item.kind === "widget");
  assert.deepEqual(widgetItems.map((item) => item.item), ["widget_task_list_results"]);

  const reconcileReportJson = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.json"), "utf8"));
  const taskBundle = reconcileReportJson.candidate_model_bundles.find((bundle) => bundle.slug === "task");
  assert.deepEqual(taskBundle.widgets, ["widget_task_list_results"]);
  assert.equal(Object.hasOwn(taskBundle, "components"), false);
});

test("brownfield import refresh updates candidates and provenance without overwriting adopted Topogram", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-refresh."));
  const sourceRoot = path.join(runRoot, "source");
  const targetRoot = path.join(runRoot, "imported");
  fs.cpSync(path.join(importFixtureRoot, "sql-openapi"), sourceRoot, { recursive: true });

  const importResult = runCli(["extract", sourceRoot, "--out", targetRoot, "--from", "db,api"]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  const write = runCli(["adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const journeyPath = path.join(targetRoot, "topo", "docs", "journeys", "task_journey.md");
  fs.appendFileSync(journeyPath, "\nLocal owner note.\n");

  fs.appendFileSync(
    path.join(sourceRoot, "db", "schema.sql"),
    "\nCREATE TABLE labels (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n);\n"
  );

  const dirtyCheck = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(dirtyCheck.status, 1);
  const dirtyPayload = JSON.parse(dirtyCheck.stdout);
  assert.equal(dirtyPayload.extract.status, "changed");
  assert.deepEqual(dirtyPayload.extract.content.changed, ["db/schema.sql"]);

  const beforeDryRunRecord = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-extract.json"), "utf8"));
  assert.equal(beforeDryRunRecord.refreshedAt, undefined);
  const diff = runCli(["extract", "diff", targetRoot, "--json"]);
  assert.equal(diff.status, 0, diff.stderr || diff.stdout);
  const diffPayload = JSON.parse(diff.stdout);
  assert.equal(diffPayload.extractStatus, "changed");
  assert.equal(diffPayload.sourceDiff.counts.changed, 1);
  assert.deepEqual(diffPayload.sourceDiff.changed, ["db/schema.sql"]);
  assert.deepEqual(diffPayload.candidateCountDeltas.deltas.dbEntities, { previous: 2, next: 3, delta: 1 });
  assert.equal(diffPayload.adoptionPlanDeltas.added.length > 0, true);
  assert.equal(diffPayload.receiptVerification.status, "changed");

  const dryRun = runCli(["extract", "refresh", "--from", sourceRoot, targetRoot, "--dry-run", "--json"]);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  const dryRunPayload = JSON.parse(dryRun.stdout);
  assert.equal(dryRunPayload.dryRun, true);
  assert.equal(dryRunPayload.previousExtractStatus, "changed");
  assert.equal(dryRunPayload.currentExtractStatus, "changed");
  assert.equal(dryRunPayload.writtenFiles.length, 0);
  assert.equal(dryRunPayload.plannedFiles.includes(".topogram-extract.json"), true);
  assert.deepEqual(dryRunPayload.candidateCountDeltas.deltas.dbEntities, { previous: 2, next: 3, delta: 1 });
  const afterDryRunRecord = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-extract.json"), "utf8"));
  assert.equal(afterDryRunRecord.refreshedAt, undefined);
  const dryRunDbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
  assert.equal(candidateIds(dryRunDbCandidates.entities).includes("entity_label"), false);

  const refresh = runCli(["extract", "refresh", "--from", sourceRoot, targetRoot, "--json"]);
  assert.equal(refresh.status, 0, refresh.stderr || refresh.stdout);
  const refreshPayload = JSON.parse(refresh.stdout);
  assert.equal(refreshPayload.ok, true);
  assert.equal(refreshPayload.dryRun, false);
  assert.equal(refreshPayload.previousExtractStatus, "changed");
  assert.equal(refreshPayload.currentExtractStatus, "clean");
  assert.equal(refreshPayload.refreshMetadata.previousSourceStatus, "changed");
  assert.deepEqual(refreshPayload.refreshMetadata.sourceDiffCounts, { changed: 1, added: 0, removed: 0 });
  assert.equal(refreshPayload.candidateCounts.dbEntities, 3);
  assert.equal(refreshPayload.removedCandidateFiles.rawCandidateFiles > 0, true);
  assert.equal(refreshPayload.removedCandidateFiles.reconcileFiles > 0, true);
  assert.equal(refreshPayload.writtenFiles.includes(".topogram-extract.json"), true);
  assert.equal(refreshPayload.writtenFiles.includes("topo/docs/journeys/task_journey.md"), false);
  assert.match(fs.readFileSync(journeyPath, "utf8"), /Local owner note/);

  const refreshedDbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
  assert.equal(candidateIds(refreshedDbCandidates.entities).includes("entity_label"), true);
  const refreshedRecord = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-extract.json"), "utf8"));
  assert.equal(typeof refreshedRecord.refreshedAt, "string");
  assert.equal(refreshedRecord.refresh.previousSourceStatus, "changed");
  assert.deepEqual(refreshedRecord.refresh.sourceDiffCounts, { changed: 1, added: 0, removed: 0 });

  const cleanCheck = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(cleanCheck.status, 0, cleanCheck.stderr || cleanCheck.stdout);
  assert.equal(JSON.parse(cleanCheck.stdout).extract.status, "clean");

  const humanRefresh = runCli(["extract", "refresh", targetRoot]);
  assert.equal(humanRefresh.status, 0, humanRefresh.stderr || humanRefresh.stdout);
  assert.match(humanRefresh.stdout, /Refreshed brownfield extraction candidates/);
  assert.match(humanRefresh.stdout, /Canonical Topogram files were not overwritten/);
});

test("brownfield import plan, adopt, and status expose public adoption UX", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extract-adoption."));
  const targetRoot = path.join(runRoot, "imported");
  const importResult = runCli([
    "extract",
    path.join(importFixtureRoot, "sql-openapi"),
    "--out",
    targetRoot,
    "--from",
    "db,api"
  ]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  const plan = runCli(["extract", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.ok, true);
  assert.deepEqual(planPayload.bundles.map((bundle) => bundle.bundle), ["database", "task", "user"]);
  assert.equal(planPayload.bundles[0].kindCounts.maintained_db_migration_seam, 1);
  assert.equal(planPayload.summary.proposalItemCount, 7);
  assert.match(planPayload.nextCommand, /topogram adopt bundle:database .* --dry-run/);

  const humanPlan = runCli(["extract", "plan", targetRoot]);
  assert.equal(humanPlan.status, 0, humanPlan.stderr || humanPlan.stdout);
  assert.match(humanPlan.stdout, /Extraction adoption plan for/);
  assert.match(humanPlan.stdout, /- database: 1 item\(s\), 1 pending, 0 applied/);
  assert.match(humanPlan.stdout, /- task: 5 item\(s\), 5 pending, 0 applied/);
  assert.match(humanPlan.stdout, /Next: topogram adopt bundle:database .* --dry-run/);

  const selectorList = runCli(["adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  assert.equal(selectorPayload.selectorCount, 3);
  assert.deepEqual(selectorPayload.selectors.map((selector) => selector.selector), ["bundle:database", "bundle:task", "bundle:user"]);
  const taskSelector = selectorPayload.selectors.find((selector) => selector.selector === "bundle:task");
  assert.match(taskSelector.previewCommand, /topogram adopt bundle:task .* --dry-run/);
  assert.match(taskSelector.writeCommand, /topogram adopt bundle:task .* --write/);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "from-plan"), true);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "capabilities"), true);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "entities"), true);

  const humanSelectorList = runCli(["adopt", "--list", targetRoot]);
  assert.equal(humanSelectorList.status, 0, humanSelectorList.stderr || humanSelectorList.stdout);
  assert.match(humanSelectorList.stdout, /Adoption selectors for/);
  assert.match(humanSelectorList.stdout, /bundle:task/);
  assert.match(humanSelectorList.stdout, /Broad selectors:/);

  const preview = runCli(["adopt", "bundle:task", targetRoot, "--json"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const previewPayload = JSON.parse(preview.stdout);
  assert.equal(previewPayload.dryRun, true);
  assert.equal(previewPayload.write, false);
  assert.equal(previewPayload.promotedCanonicalItemCount, 5);
  assert.deepEqual(previewPayload.writtenFiles, []);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), false);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-adoptions.jsonl")), false);

  const write = runCli(["adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const writePayload = JSON.parse(write.stdout);
  assert.equal(writePayload.dryRun, false);
  assert.equal(writePayload.write, true);
  assert.equal(writePayload.forced, false);
  assert.equal(writePayload.promotedCanonicalItemCount, 5);
  assert.equal(writePayload.writtenFiles.includes("entities/entity-task.tg"), true);
  assert.equal(writePayload.receipt.selector, "bundle:task");
  assert.equal(writePayload.receipt.sourceProvenance.status, "clean");
  assert.equal(writePayload.receipt.writtenFiles.includes("entities/entity-task.tg"), true);
  assert.equal(writePayload.receipt.writtenFileHashes.some((item) => item.path === "entities/entity-task.tg" && item.sha256 && item.size > 0), true);
  assert.equal(writePayload.receiptPath, path.join(targetRoot, ".topogram-adoptions.jsonl"));
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), true);

  const status = runCli(["extract", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.equal(statusPayload.extract.status, "clean");
  assert.equal(statusPayload.topogram.ok, true);
  assert.equal(statusPayload.adoption.summary.appliedItemCount, 5);
  assert.equal(statusPayload.adoption.summary.pendingItemCount, 2);
  assert.equal(statusPayload.adoption.bundles.find((bundle) => bundle.bundle === "task").complete, true);
  assert.equal(statusPayload.adoption.history.receiptCount, 1);
  assert.equal(statusPayload.adoption.history.forcedWriteCount, 0);

  const humanStatus = runCli(["extract", "status", targetRoot]);
  assert.equal(humanStatus.status, 0, humanStatus.stderr || humanStatus.stdout);
  assert.match(humanStatus.stdout, /Extraction status: clean/);
  assert.match(humanStatus.stdout, /Topogram check: passed/);
  assert.match(humanStatus.stdout, /Adoption: 5 applied, 2 pending, 0 blocked/);

  const history = runCli(["extract", "history", targetRoot, "--json"]);
  assert.equal(history.status, 0, history.stderr || history.stdout);
  const historyPayload = JSON.parse(history.stdout);
  assert.equal(historyPayload.summary.receiptCount, 1);
  assert.equal(historyPayload.summary.writeCount, 1);
  assert.equal(historyPayload.summary.forcedWriteCount, 0);
  assert.equal(historyPayload.receipts[0].selector, "bundle:task");
  assert.equal(historyPayload.receipts[0].sourceProvenance.status, "clean");
  assert.equal(historyPayload.receipts[0].writtenFileHashes.some((item) => item.path === "entities/entity-task.tg" && item.sha256), true);

  const cleanVerify = runCli(["extract", "history", "--verify", targetRoot, "--json"]);
  assert.equal(cleanVerify.status, 0, cleanVerify.stderr || cleanVerify.stdout);
  const cleanVerifyPayload = JSON.parse(cleanVerify.stdout);
  assert.equal(cleanVerifyPayload.verified, true);
  assert.equal(cleanVerifyPayload.verification.status, "matched");
  assert.equal(cleanVerifyPayload.verification.summary.changedFileCount, 0);
  assert.equal(cleanVerifyPayload.verification.summary.removedFileCount, 0);
  assert.equal(cleanVerifyPayload.verification.summary.matchedFileCount, writePayload.writtenFiles.length);

  fs.appendFileSync(path.join(targetRoot, "topo", "entities", "entity-task.tg"), "\n");
  const changedVerify = runCli(["extract", "history", targetRoot, "--verify", "--json"]);
  assert.equal(changedVerify.status, 0, changedVerify.stderr || changedVerify.stdout);
  const changedVerifyPayload = JSON.parse(changedVerify.stdout);
  assert.equal(changedVerifyPayload.verification.status, "changed");
  assert.equal(changedVerifyPayload.verification.summary.changedFileCount, 1);
  assert.equal(changedVerifyPayload.verification.files.find((item) => item.path === "entities/entity-task.tg").status, "changed");

  const editedCheck = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(editedCheck.status, 0, editedCheck.stderr || editedCheck.stdout);
  assert.equal(JSON.parse(editedCheck.stdout).extract.status, "clean");

  fs.rmSync(path.join(targetRoot, "topo", "docs", "journeys", "task_journey.md"));
  const removedVerify = runCli(["extract", "history", targetRoot, "--verify", "--json"]);
  assert.equal(removedVerify.status, 0, removedVerify.stderr || removedVerify.stdout);
  const removedVerifyPayload = JSON.parse(removedVerify.stdout);
  assert.equal(removedVerifyPayload.verification.summary.removedFileCount, 1);
  assert.equal(removedVerifyPayload.verification.files.find((item) => item.path === "docs/journeys/task_journey.md").status, "removed");

  const humanHistory = runCli(["extract", "history", targetRoot]);
  assert.equal(humanHistory.status, 0, humanHistory.stderr || humanHistory.stdout);
  assert.match(humanHistory.stdout, /Adoption history for/);
  assert.match(humanHistory.stdout, /Receipts: 1/);
  assert.match(humanHistory.stdout, /bundle:task/);

  const humanVerify = runCli(["extract", "history", targetRoot, "--verify"]);
  assert.equal(humanVerify.status, 0, humanVerify.stderr || humanVerify.stdout);
  assert.match(humanVerify.stdout, /Verification: changed/);
  assert.match(humanVerify.stdout, /entities\/entity-task\.tg: changed/);
  assert.match(humanVerify.stdout, /docs\/journeys\/task_journey\.md: removed/);
  assert.match(humanVerify.stdout, /audit-only/);
});

test("brownfield import check reports changed source evidence", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-drift."));
  const sourceRoot = path.join(runRoot, "source");
  const targetRoot = path.join(runRoot, "imported");
  fs.cpSync(path.join(importFixtureRoot, "sql-openapi"), sourceRoot, { recursive: true });

  const importResult = runCli(["extract", sourceRoot, "--out", targetRoot, "--from", "db,api"]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  fs.appendFileSync(path.join(sourceRoot, "openapi.yaml"), "\n# source changed after import\n");
  const check = runCli(["extract", "check", targetRoot, "--json"]);
  assert.equal(check.status, 1);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.extract.status, "changed");
  assert.deepEqual(payload.extract.content.changed, ["openapi.yaml"]);
  assert.equal(payload.topogram.ok, true);

  const refusedWrite = runCli(["adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(refusedWrite.status, 1);
  assert.match(refusedWrite.stderr, /Refusing to write adoption because brownfield source provenance is changed/);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), false);

  const missingReason = runCli(["adopt", "bundle:task", targetRoot, "--write", "--force", "--json"]);
  assert.equal(missingReason.status, 1);
  assert.match(missingReason.stderr, /Forced adoption writes require --reason <text>/);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-adoptions.jsonl")), false);

  const forcedWrite = runCli(["adopt", "bundle:task", targetRoot, "--write", "--force", "--reason", "Reviewed source drift", "--json"]);
  assert.equal(forcedWrite.status, 0, forcedWrite.stderr || forcedWrite.stdout);
  const forcedPayload = JSON.parse(forcedWrite.stdout);
  assert.equal(forcedPayload.forced, true);
  assert.equal(forcedPayload.reason, "Reviewed source drift");
  assert.equal(forcedPayload.extract.status, "changed");
  assert.equal(forcedPayload.warnings.length, 1);
  assert.equal(forcedPayload.receipt.forced, true);
  assert.equal(forcedPayload.receipt.reason, "Reviewed source drift");
  assert.equal(forcedPayload.receipt.sourceProvenance.status, "changed");
  assert.equal(forcedPayload.receipt.writtenFileHashes.some((item) => item.path === "entities/entity-task.tg" && item.sha256), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), true);

  const history = runCli(["extract", "history", targetRoot, "--json"]);
  assert.equal(history.status, 0, history.stderr || history.stdout);
  const historyPayload = JSON.parse(history.stdout);
  assert.equal(historyPayload.summary.receiptCount, 1);
  assert.equal(historyPayload.summary.forcedWriteCount, 1);
  assert.equal(historyPayload.receipts[0].reason, "Reviewed source drift");
  assert.equal(historyPayload.receipts[0].sourceProvenance.status, "changed");
});

function candidateIds(items) {
  return (items || []).map((item) => item.id_hint).sort();
}

function dbSeam(summary) {
  assert.equal(summary.candidates.db.maintained_seams.length, 1);
  return summary.candidates.db.maintained_seams[0];
}

function detectionIds(summary) {
  return Object.values(summary.extractor_detections || {})
    .flat()
    .map((item) => item.extractor)
    .sort();
}

function assertNoLegacyTopogramWorkspace(projectRoot) {
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram")), false);
}

function writeExtractorPackage(packageRoot, options = {}) {
  fs.mkdirSync(packageRoot, { recursive: true });
  const packageName = options.packageName || "@scope/topogram-extractor-smoke";
  const manifestId = options.manifestId || "@scope/extractor-cli-smoke";
  const track = options.track || "cli";
  const extractorId = options.extractorId || "cli.package-smoke";
  const candidateKinds = options.candidateKinds || ["command"];
  const stack = options.stack || { runtime: "node", framework: "generic-cli" };
  const capabilities = options.capabilities || { commands: true };
  const candidatesSource = options.candidatesSource || `[{
          command_id: "package_smoke",
          label: "Package Smoke",
          usage: "package-smoke",
          provenance: ["package-extractor"]
        }]`;
  const candidateObjectSource = options.malformedCandidates
    ? "{ commands: { bad: true } }"
    : options.candidateObjectSource || (track === "cli"
        ? `{ commands: ${candidatesSource} }`
        : candidatesSource);
  fs.writeFileSync(path.join(packageRoot, "package.json"), `${JSON.stringify({
    name: packageName,
    version: "1.0.0",
    main: "index.cjs"
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(packageRoot, "topogram-extractor.json"), `${JSON.stringify({
    id: manifestId,
    version: "1",
    tracks: [track],
    source: "package",
    package: packageName,
    stack,
    capabilities,
    candidateKinds,
    evidenceTypes: ["runtime_source"],
    extractors: [extractorId]
  }, null, 2)}\n`, "utf8");
  const markerLine = options.markerPath
    ? `require("node:fs").writeFileSync(${JSON.stringify(options.markerPath)}, "loaded\\n", "utf8");\n`
    : "";
  fs.writeFileSync(path.join(packageRoot, "index.cjs"), `${markerLine}const manifest = require("./topogram-extractor.json");
exports.manifest = manifest;
exports.extractors = [{
  id: ${JSON.stringify(extractorId)},
  track: ${JSON.stringify(track)},
  detect(context) {
    if (context.helpers.fs) throw new Error("package extractor received fs helper");
    return { score: 100, reasons: ["package smoke"] };
  },
  extract(context) {
    if (context.helpers.fs) throw new Error("package extractor received fs helper");
    return {
      findings: [{ kind: "package_smoke", message: "package extractor ran" }],
      candidates: ${candidateObjectSource},
      diagnostics: []
    };
  }
}];
`, "utf8");
  return packageRoot;
}

function runCli(args) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });
}
