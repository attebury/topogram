import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const engineRoot = path.join(repoRoot, "engine");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");
const expectedRoot = path.join(engineRoot, "tests", "fixtures", "expected", "app-basic");
const builtInTemplateRoot = path.join(engineRoot, "templates", "web-api-db");
const npmCacheRoot = path.join(os.tmpdir(), "topogram-generated-app-workflow-npm-cache");
fs.mkdirSync(npmCacheRoot, { recursive: true });

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [path.join(engineRoot, "src", "cli.js"), ...args], {
    cwd: options.cwd || engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: process.env.PATH || ""
    }
  });
}

function runNpm(args, cwd, options = {}) {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  return childProcess.spawnSync(npmBin, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: process.env.PATH || ""
    }
  });
}

function writePackageJson(root, pkg) {
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\s+$/, "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copyBuiltInTemplate(root, name = "template") {
  const templateRoot = path.join(root, name);
  fs.cpSync(builtInTemplateRoot, templateRoot, { recursive: true });
  return templateRoot;
}

test("public authoring-to-app commands check and generate app bundles", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /topogram check \[path\]/);
  assert.match(help.stdout, /topogram generate \[path\]/);
  assert.match(help.stdout, /topogram template check <template-spec-or-path>/);
  assert.doesNotMatch(help.stdout, /topogram build \[path\]/);
  assert.doesNotMatch(help.stdout, /query work-packet/);

  const check = runCli(["check", fixtureRoot]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-app-basic-"));
  const generate = runCli(["generate", fixtureRoot, "--out", outputRoot]);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  for (const relativePath of [
    ".topogram-generated.json",
    "README.md",
    "package.json",
    "app-bundle-plan.json",
    "scripts/bootstrap.sh",
    "scripts/compile-check.sh",
    "scripts/runtime-check.sh"
  ]) {
    assert.equal(
      readText(path.join(outputRoot, relativePath)),
      readText(path.join(expectedRoot, relativePath)),
      `${relativePath} should match the app-basic fixture`
    );
  }

  const statusAlias = runCli(["status", fixtureRoot]);
  assert.notEqual(statusAlias.status, 0, statusAlias.stdout);

  const doctorAlias = runCli(["doctor", fixtureRoot]);
  assert.notEqual(doctorAlias.status, 0, doctorAlias.stdout);

  const buildAlias = runCli(["build", fixtureRoot, "--out", outputRoot]);
  assert.notEqual(buildAlias.status, 0, buildAlias.stdout);
});

test("public commands default to project topogram and app paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-defaults-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["create", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const inspect = runCli(["check", "--json"], { cwd: projectRoot });
  assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
  assert.equal(JSON.parse(inspect.stdout).project.resolvedTopology.components.length, 3);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram new creates a generated app starter project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.match(create.stdout, /npm run check/);
  assert.match(create.stdout, /npm run generate/);

  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts.explain, "node ./scripts/explain.mjs");
  assert.equal(pkg.scripts.check, "topogram check");
  assert.equal(pkg.scripts["check:json"], "topogram check --json");
  assert.equal(pkg.scripts.generate, "topogram generate");
  assert.equal(pkg.scripts.status, undefined);
  assert.equal(pkg.scripts.inspect, undefined);
  assert.equal(pkg.scripts.build, undefined);
  assert.equal(pkg.devDependencies["@attebury/topogram"].startsWith("file:"), true);
  assert.equal(pkg.devDependencies.topogram, undefined);
  assert.equal(pkg.scripts["template:status"], "topogram template status");
  assert.equal(pkg.scripts["template:check"], undefined);
  assert.equal(pkg.scripts["template:policy:check"], "topogram template policy check");
  assert.equal(pkg.scripts["template:update:status"], "topogram template update --status");
  assert.equal(pkg.scripts["template:update:recommend"], "topogram template update --recommend");
  assert.equal(pkg.scripts["template:update:plan"], "topogram template update --plan");
  assert.equal(pkg.scripts["template:update:check"], "topogram template update --check");
  assert.equal(pkg.scripts["template:update:apply"], "topogram template update --apply");
  assert.equal(pkg.scripts["trust:status"], "topogram trust status");
  assert.equal(pkg.scripts["trust:diff"], "topogram trust diff");

  assert.match(create.stderr, /copied implementation\/ code/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-task.tg")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.template-policy.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "scripts", "explain.mjs")), true);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.project.json"), "utf8"));
  assert.equal(projectConfig.template.id, "topogram/web-api-db");
  assert.equal(projectConfig.template.requested, "web-api-db");
  assert.equal(projectConfig.template.source, "builtin");
  assert.equal(projectConfig.template.sourceSpec, "web-api-db");
  assert.equal(projectConfig.template.sourceRoot, null);
  assert.equal(projectConfig.template.includesExecutableImplementation, true);
  const policy = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.template-policy.json"), "utf8"));
  assert.deepEqual(policy.allowedTemplateIds, ["topogram/web-api-db"]);
  assert.equal(policy.executableImplementation, "allow");
  const trustRecord = JSON.parse(fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8"));
  assert.equal(trustRecord.trustPolicy, "topogram-template-executable-implementation-v1");
  assert.equal(trustRecord.template.id, "topogram/web-api-db");
  assert.equal(trustRecord.template.version, projectConfig.template.version);
  assert.equal(trustRecord.template.requested, "web-api-db");
  assert.equal(trustRecord.template.sourceSpec, "web-api-db");
  assert.equal(trustRecord.template.sourceRoot, null);
  assert.equal(trustRecord.implementation.module, "./implementation/index.js");
  assert.equal(trustRecord.content.algorithm, "sha256");
  assert.match(trustRecord.content.digest, /^[a-f0-9]{64}$/);
  assert.ok(trustRecord.content.files.some((file) => file.path === "index.js"));
  const fileManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, ".topogram-template-files.json"), "utf8"));
  assert.equal(fileManifest.template.id, "topogram/web-api-db");
  assert.equal(fileManifest.template.version, projectConfig.template.version);
  assert.ok(fileManifest.files.some((file) => file.path === "topogram.project.json"));
  assert.ok(fileManifest.files.some((file) => file.path === "topogram/entities/entity-greeting.tg"));

  const templateStatus = runCli(["template", "status", "--json"], { cwd: projectRoot });
  assert.equal(templateStatus.status, 0, templateStatus.stderr || templateStatus.stdout);
  const templateStatusPayload = JSON.parse(templateStatus.stdout);
  assert.equal(templateStatusPayload.ok, true);
  assert.equal(templateStatusPayload.template.id, "topogram/web-api-db");
  assert.equal(templateStatusPayload.template.requested, "web-api-db");
  assert.equal(templateStatusPayload.template.source, "builtin");
  assert.equal(templateStatusPayload.latest.checked, false);
  assert.equal(templateStatusPayload.trust.ok, true);

  const humanTemplateStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.equal(humanTemplateStatus.status, 0, humanTemplateStatus.stderr || humanTemplateStatus.stdout);
  assert.match(humanTemplateStatus.stdout, /Template status: trusted/);
  assert.match(humanTemplateStatus.stdout, /Latest version: not checked/);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const explain = runNpm(["run", "explain"], projectRoot);
  assert.equal(explain.status, 0, explain.stderr || explain.stdout);
  assert.match(explain.stdout, /Topogram app workflow/);
  assert.match(explain.stdout, /npm run check/);
  assert.match(explain.stdout, /npm run generate/);
  assert.match(explain.stdout, /npm run verify/);

  const check = runNpm(["run", "check"], projectRoot);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const generate = runNpm(["run", "generate"], projectRoot);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "services", "app_api")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "web", "app_sveltekit")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "db", "app_postgres")), true);
});

test("topogram generate requires local executable implementation trust", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const trustPath = path.join(projectRoot, ".topogram-template-trust.json");
  fs.rmSync(trustPath);
  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /without \.topogram-template-trust\.json/);

  const refused = runCli(["generate"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr, /without \.topogram-template-trust\.json/);
  assert.match(refused.stderr, /topogram trust template/);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Wrote \.topogram-template-files\.json/);
  assert.match(trust.stdout, /Wrote \.topogram-template-trust\.json/);
  assert.equal(fs.existsSync(trustPath), true);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram generate rejects stale template trust metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-stale-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const trustPath = path.join(projectRoot, ".topogram-template-trust.json");
  const trustRecord = JSON.parse(fs.readFileSync(trustPath, "utf8"));
  trustRecord.template.version = "0.0.0-stale";
  fs.writeFileSync(trustPath, `${JSON.stringify(trustRecord, null, 2)}\n`, "utf8");

  const refused = runCli(["generate"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr, /trusts template version '0\.0\.0-stale'/);
  assert.match(refused.stderr, /topogram\.project\.json declares/);
});

test("topogram trust status reports implementation content drift and trust refresh adopts edits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-content-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  fs.appendFileSync(path.join(projectRoot, "implementation", "index.js"), "\n// reviewed local edit\n", "utf8");
  fs.writeFileSync(path.join(projectRoot, "implementation", "local-note.js"), "export const localNote = true;\n", "utf8");
  fs.rmSync(path.join(projectRoot, "implementation", "README.md"));

  const status = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, false);
  assert.equal(statusPayload.requiresTrust, true);
  assert.match(statusPayload.issues.join("\n"), /implementation content changed/);
  assert.deepEqual(statusPayload.content.changed, ["index.js"]);
  assert.deepEqual(statusPayload.content.added, ["local-note.js"]);
  assert.deepEqual(statusPayload.content.removed, ["README.md"]);

  const humanStatus = runCli(["trust", "status"], { cwd: projectRoot });
  assert.notEqual(humanStatus.status, 0, humanStatus.stdout);
  assert.match(humanStatus.stdout, /topogram trust diff/);

  const templateStatus = runCli(["template", "status", "--json"], { cwd: projectRoot });
  assert.notEqual(templateStatus.status, 0, templateStatus.stdout);
  const templateStatusPayload = JSON.parse(templateStatus.stdout);
  assert.equal(templateStatusPayload.ok, false);
  assert.equal(templateStatusPayload.template.id, "topogram/web-api-db");
  assert.equal(templateStatusPayload.trust.ok, false);
  assert.match(templateStatusPayload.recommendations.join("\n"), /topogram trust diff/);

  const humanTemplateStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.notEqual(humanTemplateStatus.status, 0, humanTemplateStatus.stdout);
  assert.match(humanTemplateStatus.stdout, /Template status: review required/);
  assert.match(humanTemplateStatus.stdout, /Changed: index\.js/);
  assert.match(humanTemplateStatus.stdout, /topogram trust diff/);

  const diff = runCli(["trust", "diff", "--json"], { cwd: projectRoot });
  assert.notEqual(diff.status, 0, diff.stdout);
  const diffPayload = JSON.parse(diff.stdout);
  assert.equal(diffPayload.ok, false);
  assert.deepEqual(
    diffPayload.files.map((file) => `${file.kind}:${file.path}`),
    ["changed:index.js", "added:local-note.js", "removed:README.md"]
  );
  const addedFile = diffPayload.files.find((file) => file.path === "local-note.js");
  assert.match(addedFile.unifiedDiff, /\+export const localNote = true;/);
  const changedFile = diffPayload.files.find((file) => file.path === "index.js");
  assert.equal(changedFile.unifiedDiff, null);
  assert.equal(changedFile.diffOmitted, true);

  const humanDiff = runCli(["trust", "diff"], { cwd: projectRoot });
  assert.notEqual(humanDiff.status, 0, humanDiff.stdout);
  assert.match(humanDiff.stdout, /CHANGED: implementation\/index\.js/);
  assert.match(humanDiff.stdout, /ADDED: implementation\/local-note\.js/);
  assert.match(humanDiff.stdout, /\+export const localNote = true;/);
  assert.match(humanDiff.stdout, /REMOVED: implementation\/README\.md/);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /implementation content changed since it was last trusted/);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Wrote \.topogram-template-files\.json/);
  assert.match(trust.stdout, /Trusted implementation digest/);

  const cleanStatus = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.equal(cleanStatus.status, 0, cleanStatus.stderr || cleanStatus.stdout);
  const cleanPayload = JSON.parse(cleanStatus.stdout);
  assert.equal(cleanPayload.ok, true);
  assert.deepEqual(cleanPayload.content.changed, []);
  assert.deepEqual(cleanPayload.content.added, []);
  assert.deepEqual(cleanPayload.content.removed, []);
});

test("topogram template policy init and check manage project policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.rmSync(path.join(projectRoot, "topogram.template-policy.json"));

  const missing = runCli(["template", "policy", "check", "--json"], { cwd: projectRoot });
  assert.equal(missing.status, 0, missing.stderr || missing.stdout);
  const missingPayload = JSON.parse(missing.stdout);
  assert.equal(missingPayload.exists, false);
  assert.equal(missingPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_policy_missing"), true);

  const init = runCli(["template", "policy", "init", "--json"], { cwd: projectRoot });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const initPayload = JSON.parse(init.stdout);
  assert.equal(initPayload.policy.allowedTemplateIds.includes("topogram/web-api-db"), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.template-policy.json")), true);

  const check = runCli(["template", "policy", "check", "--json"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.deepEqual(checkPayload.diagnostics, []);
});

test("topogram template policy pin records a reviewed template version", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-pin-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.rmSync(path.join(projectRoot, "topogram.template-policy.json"));

  const pinCurrent = runCli(["template", "policy", "pin", "--json"], { cwd: projectRoot });
  assert.equal(pinCurrent.status, 0, pinCurrent.stderr || pinCurrent.stdout);
  const currentPayload = JSON.parse(pinCurrent.stdout);
  assert.equal(currentPayload.pinned.id, "topogram/web-api-db");
  assert.equal(currentPayload.policy.pinnedVersions["topogram/web-api-db"], currentPayload.pinned.version);

  const pinExplicit = runCli(["template", "policy", "pin", "@scope/next-template@2.0.0", "--json"], { cwd: projectRoot });
  assert.equal(pinExplicit.status, 0, pinExplicit.stderr || pinExplicit.stdout);
  const explicitPayload = JSON.parse(pinExplicit.stdout);
  assert.equal(explicitPayload.policy.pinnedVersions["@scope/next-template"], "2.0.0");
  assert.equal(explicitPayload.policy.allowedTemplateIds.includes("@scope/next-template"), true);
  assert.equal(explicitPayload.policy.allowedPackageScopes.includes("@scope"), true);
});

test("topogram new supports local path template packs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-local-template-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/web-api-db/);
  assert.match(create.stderr, /topogram generate may load it later/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("topogram template update emits a non-writing update plan", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-plan-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = "0.2.0";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# candidate template edit\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-note.tg"),
    `entity entity_note {
  name "Note"
  description "A note added by a template update"
  fields {
    id uuid required
  }
  status active
}
`,
    "utf8"
  );

  const plan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const payload = JSON.parse(plan.stdout);
  assert.equal(payload.writes, false);
  assert.deepEqual(payload.diagnostics, []);
  assert.equal(payload.current.id, "topogram/web-api-db");
  assert.equal(payload.candidate.id, "topogram/web-api-db");
  assert.equal(payload.candidate.version, "0.2.0");
  assert.equal(payload.summary.added, 1);
  assert.ok(payload.summary.changed >= 2);
  assert.ok(payload.files.some((file) => file.kind === "changed" && file.path === "topogram/entities/entity-greeting.tg"));
  assert.ok(payload.files.some((file) => file.kind === "added" && file.path === "topogram/entities/entity-note.tg"));
  assert.match(
    payload.files.find((file) => file.path === "topogram/entities/entity-greeting.tg").unifiedDiff,
    /\+# candidate template edit/
  );
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-note.tg")), false);

  const humanPlan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.equal(humanPlan.status, 0, humanPlan.stderr || humanPlan.stdout);
  assert.match(humanPlan.stdout, /Template update plan: ready for review/);
  assert.match(humanPlan.stdout, /Writes: none/);
  assert.match(humanPlan.stdout, /ADDED: topogram\/entities\/entity-note\.tg/);
});

test("topogram template update check reports clean and pending updates without writing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-check-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const cleanCheck = runCli(["template", "update", "--check", "--json"], { cwd: projectRoot });
  assert.equal(cleanCheck.status, 0, cleanCheck.stderr || cleanCheck.stdout);
  const cleanPayload = JSON.parse(cleanCheck.stdout);
  assert.equal(cleanPayload.mode, "check");
  assert.equal(cleanPayload.ok, true);
  assert.equal(cleanPayload.writes, false);
  assert.deepEqual(cleanPayload.diagnostics, []);

  const cleanHuman = runCli(["template", "update", "--check"], { cwd: projectRoot });
  assert.equal(cleanHuman.status, 0, cleanHuman.stderr || cleanHuman.stdout);
  assert.match(cleanHuman.stdout, /Template update check: aligned/);
  assert.match(cleanHuman.stdout, /This command did not write files/);

  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# candidate check edit\n",
    "utf8"
  );
  const pendingCheck = runCli(["template", "update", "--check", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(pendingCheck.status, 0, pendingCheck.stdout);
  const pendingPayload = JSON.parse(pendingCheck.stdout);
  assert.equal(pendingPayload.mode, "check");
  assert.equal(pendingPayload.writes, false);
  assert.equal(pendingPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_available"), true);
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg"), "utf8"), /candidate check edit/);
});

test("topogram template update status reports action needed and writes review report", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-status-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const reportPath = path.join(root, "reports", "template-update-report.json");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(projectRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# local status edit\n",
    "utf8"
  );
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# candidate status edit\n",
    "utf8"
  );

  const status = runCli([
    "template",
    "update",
    "--status",
    "--template",
    nextTemplateRoot,
    "--json",
    "--out",
    reportPath
  ], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.mode, "status");
  assert.equal(payload.writes, false);
  assert.equal(payload.conflicts.some((conflict) => conflict.path === "topogram/entities/entity-greeting.tg"), true);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_conflict"), true);
  assert.equal(payload.reportPath, reportPath);
  const report = readJson(reportPath);
  assert.equal(report.mode, "status");
  assert.equal(report.reportPath, undefined);
  assert.equal(report.conflicts.some((conflict) => conflict.path === "topogram/entities/entity-greeting.tg"), true);

  const humanStatus = runCli(["template", "update", "--status", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.notEqual(humanStatus.status, 0, humanStatus.stdout);
  assert.match(humanStatus.stdout, /Template update status: action needed/);
  assert.match(humanStatus.stdout, /Refused due to 1 conflict\(s\)/);
});

test("topogram template update recommend explains the next reviewed action", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-recommend-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const reportPath = path.join(root, "reports", "recommendation.json");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.version = "0.2.0";
  writeJson(manifestPath, manifest);
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# candidate recommend edit\n",
    "utf8"
  );

  const recommend = runCli([
    "template",
    "update",
    "--recommend",
    "--template",
    nextTemplateRoot,
    "--json",
    "--out",
    reportPath
  ], { cwd: projectRoot });
  assert.equal(recommend.status, 0, recommend.stderr || recommend.stdout);
  const payload = JSON.parse(recommend.stdout);
  assert.equal(payload.mode, "recommend");
  assert.equal(payload.writes, false);
  assert.equal(payload.recommendations.some((item) => item.action === "apply-candidate" && item.command === "topogram template update --apply"), true);
  assert.equal(payload.recommendations.some((item) => item.action === "pin-reviewed-version" && item.command === "topogram template policy pin topogram/web-api-db@0.2.0"), true);
  assert.equal(readJson(reportPath).mode, "recommend");

  const human = runCli(["template", "update", "--recommend", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Template update recommendation: ready/);
  assert.match(human.stdout, /Recommended next steps:/);
  assert.match(human.stdout, /topogram template update --apply/);
});

test("topogram template update accept-current adopts local file baseline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-accept-current-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topogram/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(path.join(projectRoot, relativeFile), "\n# local accepted edit\n", "utf8");
  fs.appendFileSync(path.join(nextTemplateRoot, relativeFile), "\n# candidate edit\n", "utf8");

  const refused = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.equal(JSON.parse(refused.stdout).conflicts.some((conflict) => conflict.path === relativeFile), true);

  const accept = runCli(["template", "update", "--accept-current", relativeFile, "--json"], { cwd: projectRoot });
  assert.equal(accept.status, 0, accept.stderr || accept.stdout);
  const payload = JSON.parse(accept.stdout);
  assert.equal(payload.mode, "accept-current");
  assert.equal(payload.writes, true);
  assert.equal(payload.accepted.some((file) => file.path === relativeFile), true);
  const baseline = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  const record = baseline.files.find((file) => file.path === relativeFile);
  assert.ok(record);
  assert.match(fs.readFileSync(path.join(projectRoot, relativeFile), "utf8"), /# local accepted edit/);

  const status = runCli(["template", "update", "--status", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  assert.equal(JSON.parse(status.stdout).conflicts.some((conflict) => conflict.path === relativeFile), false);
});

test("topogram template update accept-candidate applies one safe candidate file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-accept-candidate-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topogram/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(path.join(nextTemplateRoot, relativeFile), "\n# single candidate edit\n", "utf8");

  const accept = runCli(["template", "update", "--accept-candidate", relativeFile, "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(accept.status, 0, accept.stderr || accept.stdout);
  const payload = JSON.parse(accept.stdout);
  assert.equal(payload.mode, "accept-candidate");
  assert.equal(payload.writes, true);
  assert.equal(payload.applied.some((file) => file.path === relativeFile && file.kind === "changed"), true);
  assert.match(fs.readFileSync(path.join(projectRoot, relativeFile), "utf8"), /# single candidate edit/);
});

test("topogram template update delete-current removes one baseline-matching current-only file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-delete-current-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topogram/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.rmSync(path.join(nextTemplateRoot, relativeFile));

  const deleted = runCli(["template", "update", "--delete-current", relativeFile, "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(deleted.status, 0, deleted.stderr || deleted.stdout);
  const payload = JSON.parse(deleted.stdout);
  assert.equal(payload.mode, "delete-current");
  assert.equal(payload.writes, true);
  assert.equal(payload.deleted.some((file) => file.path === relativeFile), true);
  assert.equal(fs.existsSync(path.join(projectRoot, relativeFile)), false);
  const baseline = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  assert.equal(baseline.files.some((file) => file.path === relativeFile), false);
});

test("topogram template update reports incompatible template ids", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-id-mismatch-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.id = "topogram/other-template";
  writeJson(manifestPath, manifest);

  const plan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(plan.status, 0, plan.stdout);
  const payload = JSON.parse(plan.stdout);
  assert.equal(payload.compatible, false);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_id_mismatch"), true);
});

test("topogram template policy denies disallowed sources, executable templates, and version mismatches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-deny-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });

  const policyPath = path.join(projectRoot, "topogram.template-policy.json");
  const policy = readJson(policyPath);
  policy.allowedSources = ["builtin"];
  writeJson(policyPath, policy);
  const localDenied = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(localDenied.status, 0, localDenied.stdout);
  assert.equal(JSON.parse(localDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "template_source_denied"), true);

  policy.allowedSources = ["builtin", "local", "package"];
  policy.executableImplementation = "deny";
  writeJson(policyPath, policy);
  const executableDenied = runCli(["template", "update", "--status", "--json"], { cwd: projectRoot });
  assert.notEqual(executableDenied.status, 0, executableDenied.stdout);
  assert.equal(JSON.parse(executableDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "template_executable_denied"), true);

  policy.executableImplementation = "allow";
  policy.pinnedVersions = { "topogram/web-api-db": "0.0.0-pinned" };
  writeJson(policyPath, policy);
  const versionDenied = runCli(["template", "update", "--status", "--json"], { cwd: projectRoot });
  assert.notEqual(versionDenied.status, 0, versionDenied.stdout);
  assert.equal(JSON.parse(versionDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "template_version_mismatch"), true);
});

test("topogram template check enforces caller template policy when present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-policy-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const policy = readJson(path.join(projectRoot, "topogram.template-policy.json"));
  policy.allowedSources = ["builtin"];
  writeJson(path.join(projectRoot, "topogram.template-policy.json"), policy);

  const check = runCli(["template", "check", builtInTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_source_denied"), true);
  assert.equal(payload.steps.some((step) => step.name === "template-policy" && step.ok === false), true);
});

test("topogram template update applies reviewed template-owned changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-apply-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.version = "0.3.0";
  writeJson(manifestPath, manifest);
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# applied template edit\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-note.tg"),
    `entity entity_note {
  name "Note"
  description "A note added by a template update"
  fields {
    id uuid required
  }
  status active
}
`,
    "utf8"
  );

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.writes, true);
  assert.deepEqual(payload.diagnostics, []);
  assert.equal(payload.candidate.version, "0.3.0");
  assert.ok(payload.applied.some((file) => file.path === "topogram/entities/entity-greeting.tg"));
  assert.ok(payload.applied.some((file) => file.path === "topogram/entities/entity-note.tg"));
  assert.match(fs.readFileSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg"), "utf8"), /# applied template edit/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-note.tg")), true);
  const projectConfig = readJson(path.join(projectRoot, "topogram.project.json"));
  assert.equal(projectConfig.template.version, "0.3.0");
  const fileManifest = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  assert.equal(fileManifest.template.version, "0.3.0");

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const trustStatus = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.equal(trustStatus.status, 0, trustStatus.stderr || trustStatus.stdout);
  assert.equal(JSON.parse(trustStatus.stdout).ok, true);

  const baselineBeforeNoop = fs.readFileSync(path.join(projectRoot, ".topogram-template-files.json"), "utf8");
  const trustBeforeNoop = fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8");
  const humanApply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.equal(humanApply.status, 0, humanApply.stderr || humanApply.stdout);
  assert.match(humanApply.stdout, /Template update apply: complete/);
  assert.match(humanApply.stdout, /Writes: none/);
  assert.match(humanApply.stdout, /No changes to apply/);
  assert.equal(fs.readFileSync(path.join(projectRoot, ".topogram-template-files.json"), "utf8"), baselineBeforeNoop);
  assert.equal(fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8"), trustBeforeNoop);
});

test("topogram template update apply refuses local template-owned conflicts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-conflict-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(projectRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# local edit\n",
    "utf8"
  );
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# candidate edit\n",
    "utf8"
  );

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(apply.status, 0, apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.writes, false);
  assert.ok(payload.conflicts.some((conflict) => conflict.path === "topogram/entities/entity-greeting.tg"));
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_conflict"), true);
  const currentText = fs.readFileSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg"), "utf8");
  assert.match(currentText, /# local edit/);
  assert.doesNotMatch(currentText, /# candidate edit/);

  const humanApply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.notEqual(humanApply.status, 0, humanApply.stdout);
  assert.match(humanApply.stdout, /Template update apply: refused/);
  assert.match(humanApply.stdout, /Refused due to 1 conflict\(s\)/);
  assert.match(humanApply.stdout, /Conflict: topogram\/entities\/entity-greeting\.tg/);
});

test("topogram trust template records template-owned baseline for update apply", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-baseline-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.rmSync(path.join(projectRoot, ".topogram-template-files.json"));
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# candidate edit after baseline\n",
    "utf8"
  );

  const refused = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  const refusedPayload = JSON.parse(refused.stdout);
  assert.match(refusedPayload.issues.join("\n"), /\.topogram-template-files\.json is missing/);
  assert.equal(refusedPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_baseline_missing"), true);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Wrote \.topogram-template-files\.json/);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  assert.ok(JSON.parse(apply.stdout).applied.some((file) => file.path === "topogram/entities/entity-greeting.tg"));
});

test("topogram template update apply skips current-only deletes with diagnostics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-skip-delete-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.rmSync(path.join(nextTemplateRoot, "topogram", "entities", "entity-greeting.tg"));

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.ok, true);
  assert.equal(payload.writes, true);
  assert.equal(payload.skipped.some((file) => file.path === "topogram/entities/entity-greeting.tg"), true);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_current_only_skipped"), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
});

test("topogram template check validates reusable template conformance", () => {
  const check = runCli(["template", "check", builtInTemplateRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.templateSpec, builtInTemplateRoot);
  assert.equal(payload.steps.find((step) => step.name === "create-starter").ok, true);
  assert.equal(payload.steps.find((step) => step.name === "starter-check").ok, true);
  assert.equal(payload.steps.find((step) => step.name === "executable-implementation-trust").details.requiresTrust, true);
  assert.equal(payload.steps.find((step) => step.name === "template-update-plan").details.writes, false);
  assert.deepEqual(payload.diagnostics, []);

  const humanCheck = runCli(["template", "check", builtInTemplateRoot]);
  assert.equal(humanCheck.status, 0, humanCheck.stderr || humanCheck.stdout);
  assert.match(humanCheck.stdout, /Template check passed/);
  assert.match(humanCheck.stdout, /PASS create-starter/);
  assert.match(humanCheck.stdout, /Temp starter:/);
  assert.match(humanCheck.stdout, /PASS starter-check/);
  assert.match(humanCheck.stdout, /PASS executable-implementation-trust/);
  assert.match(humanCheck.stdout, /PASS template-update-plan/);
});

test("topogram template check reports invalid template conformance", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-invalid-"));
  const templateRoot = path.join(root, "bad-template");
  fs.mkdirSync(path.join(templateRoot, "topogram"), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, "topogram.project.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(templateRoot, "topogram-template.json"), JSON.stringify({
    id: "bad-template",
    version: "0.1.0",
    kind: "starter"
  }, null, 2));

  const check = runCli(["template", "check", templateRoot, "--json"]);
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  assert.match(payload.errors.join("\n"), /topogramVersion/);
  assert.equal(payload.diagnostics[0].code, "template_manifest_invalid");
  assert.equal(payload.diagnostics[0].severity, "error");
  assert.match(payload.diagnostics[0].path, /topogram-template\.json$/);
  assert.match(payload.diagnostics[0].suggestedFix, /manifest schema/);
  assert.equal(payload.steps.find((step) => step.name === "create-starter").ok, false);

  const humanCheck = runCli(["template", "check", templateRoot]);
  assert.notEqual(humanCheck.status, 0, humanCheck.stdout);
  assert.match(humanCheck.stdout, /FAIL create-starter/);
  assert.match(humanCheck.stdout, /\[error\] template_manifest_invalid:/);
  assert.match(humanCheck.stdout, /fix: Fix topogram-template\.json/);
});

for (const scenario of [
  {
    name: "missing manifest",
    code: "template_manifest_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "topogram-template.json"));
    }
  },
  {
    name: "missing topogram",
    code: "template_topogram_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "topogram"), { recursive: true });
    }
  },
  {
    name: "missing project config",
    code: "template_project_config_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "topogram.project.json"));
    }
  },
  {
    name: "missing implementation",
    code: "template_implementation_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "implementation"), { recursive: true });
    }
  }
]) {
  test(`topogram template check reports ${scenario.name}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-shape-"));
    const templateRoot = copyBuiltInTemplate(root, "bad-template");
    scenario.setup(templateRoot);

    const check = runCli(["template", "check", templateRoot, "--json"]);
    assert.notEqual(check.status, 0, check.stdout);
    const payload = JSON.parse(check.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.diagnostics[0].code, scenario.code);
    assert.equal(payload.diagnostics[0].step, "create-starter");
    assert.equal(payload.steps.find((step) => step.name === "create-starter").diagnostics[0].code, scenario.code);
    assert.ok(payload.diagnostics[0].suggestedFix);
  });
}

test("topogram template check reports invalid generated project config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-project-"));
  const templateRoot = copyBuiltInTemplate(root, "bad-project-config");
  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.topology.components[0].generator.id = "topogram/not-real";
  writeJson(projectConfigPath, projectConfig);

  const check = runCli(["template", "check", templateRoot, "--json"]);
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  const diagnostic = payload.diagnostics.find((item) => item.code === "starter_check_failed");
  assert.ok(diagnostic);
  assert.match(diagnostic.message, /unknown generator 'topogram\/not-real'/);
  assert.equal(fs.realpathSync(diagnostic.path), fs.realpathSync(path.join(payload.projectRoot, "topogram.project.json")));
  assert.equal(payload.steps.find((step) => step.name === "starter-check").ok, false);
});

test("topogram template check reports missing starter implementation trust", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-trust-"));
  const templateRoot = copyBuiltInTemplate(root, "bad-trust");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.includesExecutableImplementation = false;
  writeJson(manifestPath, manifest);

  const check = runCli(["template", "check", templateRoot, "--json"]);
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  const diagnostic = payload.diagnostics.find((item) => item.code === "template_trust_invalid");
  assert.ok(diagnostic);
  assert.match(diagnostic.message, /without \.topogram-template-trust\.json/);
  assert.match(diagnostic.suggestedFix, /topogram trust template/);
  assert.equal(payload.steps.find((step) => step.name === "starter-check").ok, false);
});

test("topogram template update requires explicit plan mode", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-write-refusal-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const update = runCli(["template", "update"], { cwd: projectRoot });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /requires `--status`, `--recommend`, `--plan`, `--check`, `--apply`/);
});

test("topogram new supports packed npm template packs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-packed-template-"));
  const templatePackageRoot = path.join(root, "template-package");
  const packRoot = path.join(root, "pack");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(packRoot);
  fs.cpSync(builtInTemplateRoot, templatePackageRoot, { recursive: true });
  writePackageJson(templatePackageRoot, {
    name: "@attebury/topogram-template-test",
    version: "0.1.0",
    private: true,
    type: "module",
    files: ["topogram-template.json", "topogram", "topogram.project.json", "implementation"]
  });

  const pack = runNpm(["pack", "--pack-destination", packRoot], templatePackageRoot, {
    env: { npm_config_cache: npmCacheRoot }
  });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const tarball = path.join(packRoot, pack.stdout.trim().split(/\s+/).at(-1));

  const create = runCli(["new", projectRoot, "--template", tarball], {
    env: { npm_config_cache: npmCacheRoot }
  });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/web-api-db/);
  assert.match(create.stderr, /copied implementation\/ code/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
});

test("topogram new reports invalid template manifests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-invalid-template-"));
  const templateRoot = path.join(root, "bad-template");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(path.join(templateRoot, "topogram"), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, "topogram.project.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(templateRoot, "topogram-template.json"), JSON.stringify({
    id: "bad-template",
    version: "0.1.0",
    kind: "starter"
  }, null, 2));

  const create = runCli(["new", projectRoot, "--template", templateRoot]);
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /topogram-template\.json is missing required string field 'topogramVersion'/);
});

test("repo root new script creates a generated app starter project outside engine", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-root-create-"));
  const projectRoot = path.join(root, "starter");
  const create = runNpm(["run", "new", "--", projectRoot], repoRoot);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
});

test("repo root smoke test app script creates and generates disposable app", () => {
  const result = runNpm(["run", "smoke:test-app"], repoRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Smoke test app generated/);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp", "smoke-test-app", "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp", "smoke-test-app", "app", ".topogram-generated.json")), true);
});

test("topogram new refuses to create generated projects inside engine", () => {
  const create = runCli(["new", "./my-topogram-app"]);
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /inside the engine directory/);
  assert.equal(fs.existsSync(path.join(engineRoot, "my-topogram-app")), false);
});
