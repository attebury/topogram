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
      PATH: options.env?.PATH || process.env.PATH || ""
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
      PATH: options.env?.PATH || process.env.PATH || ""
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

function createCatalog(root, entries) {
  fs.mkdirSync(root, { recursive: true });
  const catalogPath = path.join(root, "topograms.catalog.json");
  writeJson(catalogPath, {
    version: "0.1",
    entries
  });
  return catalogPath;
}

function catalogEntry(overrides = {}) {
  return {
    id: "todo",
    kind: "template",
    package: "@scope/topogram-template-todo",
    defaultVersion: "0.1.0",
    description: "Todo starter",
    tags: ["todo", "demo"],
    surfaces: ["web", "api", "database"],
    generators: ["topogram/sveltekit", "topogram/hono", "topogram/postgres"],
    stack: "SvelteKit + Hono + Postgres",
    trust: {
      scope: "@scope",
      includesExecutableImplementation: true,
      notes: "Test fixture package."
    },
    ...overrides
  };
}

function createPureTopogramPackage(root, name = "topogram-package", options = {}) {
  const packageRoot = path.join(root, name);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.cpSync(path.join(builtInTemplateRoot, "topogram"), path.join(packageRoot, "topogram"), { recursive: true });
  writeJson(path.join(packageRoot, "topogram.project.json"), {
    version: "0.1",
    outputs: {
      app: {
        path: "./app",
        ownership: "generated"
      }
    },
    topology: {
      components: []
    }
  });
  fs.writeFileSync(path.join(packageRoot, "README.md"), "# Test topogram package\n", "utf8");
  writePackageJson(packageRoot, {
    name: "@scope/topogram-hello",
    version: "0.1.0",
    private: true,
    files: ["topogram", "topogram.project.json", "README.md"]
  });
  if (options.implementation) {
    fs.mkdirSync(path.join(packageRoot, "implementation"), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, "implementation", "index.js"), "export const unsafe = true;\n", "utf8");
  }
  return packageRoot;
}

function createFakeNpm(root) {
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const npmPath = path.join(binDir, "npm");
  fs.writeFileSync(npmPath, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("10.0.0\\n");
  process.exit(0);
}
if (args[0] === "config" && args[1] === "get") {
  if (args[2] === "@attebury:registry") {
    process.stdout.write((process.env.FAKE_NPM_ATTEBURY_REGISTRY || "https://npm.pkg.github.com") + "\\n");
    process.exit(0);
  }
  process.stdout.write("undefined\\n");
  process.exit(0);
}
function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const [scope, rest] = spec.split("/");
    const versionIndex = rest.indexOf("@");
    return path.join(scope, versionIndex >= 0 ? rest.slice(0, versionIndex) : rest);
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex >= 0 ? spec.slice(0, versionIndex) : spec;
}
if (args[0] === "view") {
  if (process.env.FAKE_NPM_VIEW_FAIL_SPEC && args[1].includes(process.env.FAKE_NPM_VIEW_FAIL_SPEC)) {
    process.stderr.write(process.env.FAKE_NPM_VIEW_FAIL_OUTPUT || "npm ERR! 403 Forbidden\\n");
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(process.env.FAKE_NPM_LATEST_VERSION || "0.2.0") + "\\n");
  process.exit(0);
}
if (args[0] === "install") {
  const prefixIndex = args.indexOf("--prefix");
  const spec = args[args.length - 1];
  if (prefixIndex < 0) {
    const packageName = packageNameFromSpec(spec).replace(/\\\\/g, "/");
    const versionMatch = spec.match(/@\\^?([^@/]+)$/);
    const version = versionMatch ? versionMatch[1] : "0.0.0";
    const packagePath = path.join(process.cwd(), "package.json");
    const pkg = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};
    pkg.devDependencies = { ...(pkg.devDependencies || {}), [packageName]: spec.startsWith(packageName + "@") ? spec.slice(packageName.length + 1) : spec };
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\\n");
    const lockPath = path.join(process.cwd(), "package-lock.json");
    fs.writeFileSync(lockPath, JSON.stringify({
      name: pkg.name || "consumer",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": { name: pkg.name || "consumer", devDependencies: pkg.devDependencies },
        ["node_modules/" + packageName]: {
          version,
          dev: true,
          bin: { topogram: "src/cli.js" }
        }
      }
    }, null, 2) + "\\n");
    process.exit(0);
  }
  const prefix = args[prefixIndex + 1];
  const packageMap = process.env.FAKE_NPM_PACKAGES ? JSON.parse(process.env.FAKE_NPM_PACKAGES) : {};
  const source = packageMap[spec] ||
    packageMap[packageNameFromSpec(spec)] ||
    (spec.endsWith("@0.1.0") ? process.env.FAKE_TEMPLATE_INITIAL : process.env.FAKE_TEMPLATE_LATEST);
  if (!source) {
    process.stderr.write("No fake npm package source for " + spec + "\\n");
    process.exit(1);
  }
  const target = path.join(prefix, "node_modules", packageNameFromSpec(spec));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  process.exit(0);
}
if (args[0] === "run") {
  if (process.env.FAKE_NPM_RUN_LOG) {
    fs.appendFileSync(process.env.FAKE_NPM_RUN_LOG, args[1] + "\\n", "utf8");
  }
  process.stdout.write("ran " + args[1] + "\\n");
  process.exit(0);
}
process.stderr.write("Unexpected fake npm command: " + args.join(" ") + "\\n");
process.exit(1);
`, "utf8");
  fs.chmodSync(npmPath, 0o755);
  return binDir;
}

function createFailingCommand(root, name, stderr, status = 1) {
  const binDir = path.join(root, `bin-${name}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(binDir, { recursive: true });
  const commandPath = path.join(binDir, name);
  fs.writeFileSync(commandPath, `#!/usr/bin/env node
process.stderr.write(${JSON.stringify(stderr)});
process.exit(${status});
`, "utf8");
  fs.chmodSync(commandPath, 0o755);
  return binDir;
}

test("public authoring-to-app commands check and generate app bundles", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /topogram check \[path\]/);
  assert.match(help.stdout, /topogram generate \[path\]/);
  assert.match(help.stdout, /topogram new <path> \[--template .*todo/);
  assert.match(help.stdout, /topogram new \.\/my-app/);
  assert.match(help.stdout, /topogram new \.\/my-app --template todo/);
  assert.match(help.stdout, /Template and catalog discovery:/);
  assert.match(help.stdout, /topogram catalog show todo/);
  assert.match(help.stdout, /topogram source status/);
  assert.match(help.stdout, /topogram template list/);
  assert.doesNotMatch(help.stdout, /topogram template show todo/);
  assert.match(help.stdout, /Default starter: hello-web/);
  assert.match(help.stdout, /topogram template status --latest/);
  assert.match(help.stdout, /topogram template policy explain/);
  assert.match(help.stdout, /topogram template check <template-spec-or-path>/);
  assert.doesNotMatch(help.stdout, /topogram create \.\/my-app/);
  assert.doesNotMatch(help.stdout, /topogram import app \.\/existing-app/);
  assert.doesNotMatch(help.stdout, /topogram build \[path\]/);
  assert.doesNotMatch(help.stdout, /query work-packet/);

  const fullHelp = runCli(["help", "all"]);
  assert.equal(fullHelp.status, 0, fullHelp.stderr || fullHelp.stdout);
  assert.match(fullHelp.stdout, /topogram create <path>/);
  assert.match(fullHelp.stdout, /topogram import app <path>/);
  assert.match(fullHelp.stdout, /query work-packet/);

  const templateList = runCli(["template", "list", "--json"]);
  assert.equal(templateList.status, 0, templateList.stderr || templateList.stdout);
  const listPayload = JSON.parse(templateList.stdout);
  assert.equal(listPayload.templates.some((template) => template.id === "topogram/hello-web" && template.source === "builtin"), true);
  assert.equal(listPayload.templates.some((template) => template.id === "topogram/hello-api" && template.source === "builtin"), true);
  assert.equal(listPayload.templates.some((template) => template.id === "topogram/hello-db" && template.source === "builtin"), true);
  assert.equal(listPayload.templates.some((template) => template.id === "topogram/web-api" && template.source === "builtin"), true);
  assert.equal(listPayload.templates.some((template) => template.id === "topogram/web-api-db" && template.source === "builtin"), true);
  const helloWebTemplate = listPayload.templates.find((template) => template.id === "topogram/hello-web");
  assert.equal(helloWebTemplate.isDefault, true);
  assert.equal(helloWebTemplate.stack, "Vanilla HTML/CSS/JS");
  assert.deepEqual(helloWebTemplate.surfaces, ["web"]);
  const webApiTemplate = listPayload.templates.find((template) => template.id === "topogram/web-api");
  assert.equal(webApiTemplate.stack, "React + Express");
  assert.deepEqual(webApiTemplate.surfaces, ["web", "api"]);

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
    "scripts/runtime.sh",
    "scripts/wait-for-stack.mjs",
    "scripts/runtime-check.sh"
  ]) {
    assert.equal(
      readText(path.join(outputRoot, relativePath)),
      readText(path.join(expectedRoot, relativePath)),
      `${relativePath} should match the app-basic fixture`
    );
  }

  const runtimePackageJson = readJson(path.join(outputRoot, "apps", "package.json"));
  assert.equal(runtimePackageJson.scripts["docker:db"], undefined);
  assert.equal(runtimePackageJson.scripts["docker:stack"], undefined);
  assert.equal(fs.existsSync(path.join(outputRoot, "apps", "scripts", "docker-db.sh")), false);
  assert.equal(fs.existsSync(path.join(outputRoot, "apps", "scripts", "docker-stack.sh")), false);

  const statusAlias = runCli(["status", fixtureRoot]);
  assert.notEqual(statusAlias.status, 0, statusAlias.stdout);

  const buildAlias = runCli(["build", fixtureRoot, "--out", outputRoot]);
  assert.notEqual(buildAlias.status, 0, buildAlias.stdout);
});

test("topogram catalog check validates catalog schema", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-check-"));
  const validCatalog = createCatalog(root, [
    catalogEntry(),
    catalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const check = runCli(["catalog", "check", validCatalog, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.catalog.entries.length, 2);

  const duplicateCatalog = createCatalog(path.join(root, "duplicate"), [
    catalogEntry(),
    catalogEntry({ id: "todo", package: "@scope/topogram-template-other" })
  ]);
  const duplicate = runCli(["catalog", "check", duplicateCatalog, "--json"]);
  assert.notEqual(duplicate.status, 0, duplicate.stdout);
  assert.equal(JSON.parse(duplicate.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_duplicate_id"), true);

  const invalidKindCatalog = createCatalog(path.join(root, "invalid-kind"), [
    catalogEntry({ kind: "app" })
  ]);
  const invalidKind = runCli(["catalog", "check", invalidKindCatalog, "--json"]);
  assert.notEqual(invalidKind.status, 0, invalidKind.stdout);
  assert.equal(JSON.parse(invalidKind.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_invalid_kind"), true);

  const missingPackageCatalog = createCatalog(path.join(root, "missing-package"), [
    catalogEntry({ package: "" })
  ]);
  const missingPackage = runCli(["catalog", "check", missingPackageCatalog, "--json"]);
  assert.notEqual(missingPackage.status, 0, missingPackage.stdout);
  assert.equal(JSON.parse(missingPackage.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_entry_field_missing"), true);

  const executableTopogramCatalog = createCatalog(path.join(root, "executable-topogram"), [
    catalogEntry({
      id: "unsafe",
      kind: "topogram",
      package: "@scope/topogram-unsafe",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: true
      }
    })
  ]);
  const executableTopogram = runCli(["catalog", "check", executableTopogramCatalog, "--json"]);
  assert.notEqual(executableTopogram.status, 0, executableTopogram.stdout);
  assert.equal(
    JSON.parse(executableTopogram.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_topogram_executable_not_supported"),
    true
  );

  const optionalMetadataCatalog = createCatalog(path.join(root, "optional-metadata"), [
    catalogEntry({
      surfaces: ["web", "spaceship"],
      generators: "topogram/hono",
      stack: ["Hono"]
    })
  ]);
  const optionalMetadata = runCli(["catalog", "check", optionalMetadataCatalog, "--json"]);
  assert.equal(optionalMetadata.status, 0, optionalMetadata.stderr || optionalMetadata.stdout);
  const optionalPayload = JSON.parse(optionalMetadata.stdout);
  assert.equal(optionalPayload.ok, true);
  assert.equal(optionalPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_optional_surface_unknown"), true);
  assert.equal(optionalPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_optional_generators_invalid"), true);
  assert.equal(optionalPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_optional_stack_invalid"), true);
});

test("topogram catalog doctor reports catalog and package access", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-doctor-"));
  const fakeNpmBin = createFakeNpm(root);
  const catalogPath = createCatalog(root, [
    catalogEntry(),
    catalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);
  const env = {
    FAKE_NPM_LATEST_VERSION: "0.1.0",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const doctor = runCli(["catalog", "doctor", "--catalog", catalogPath, "--json"], { env });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.catalog.reachable, true);
  assert.equal(payload.catalog.entries, 2);
  assert.equal(payload.packages.length, 2);
  assert.equal(payload.packages.every((item) => item.ok), true);
  assert.equal(payload.packages[0].packageSpec, "@scope/topogram-template-todo@0.1.0");

  const human = runCli(["catalog", "doctor", "--catalog", catalogPath], { env });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Catalog doctor passed/);
  assert.match(human.stdout, /Catalog reachable: yes/);
  assert.match(human.stdout, /@scope\/topogram-template-todo@0\.1\.0 ok/);

  const denied = runCli(["catalog", "doctor", "--catalog", catalogPath, "--json"], {
    env: {
      ...env,
      FAKE_NPM_VIEW_FAIL_SPEC: "@scope/topogram-hello@0.1.0",
      FAKE_NPM_VIEW_FAIL_OUTPUT: "npm ERR! 403 Forbidden"
    }
  });
  assert.notEqual(denied.status, 0, denied.stdout);
  const deniedPayload = JSON.parse(denied.stdout);
  assert.equal(deniedPayload.ok, false);
  assert.equal(deniedPayload.packages.find((item) => item.id === "hello").diagnostics[0].code, "catalog_package_access_denied");
});

test("topogram doctor checks runtime, GitHub Packages, and catalog access", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-doctor-"));
  const fakeNpmBin = createFakeNpm(root);
  const catalogPath = createCatalog(root, [
    catalogEntry()
  ]);
  const env = {
    FAKE_NPM_LATEST_VERSION: "0.1.0",
    NODE_AUTH_TOKEN: "test-token",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const doctor = runCli(["doctor", "--catalog", catalogPath, "--json"], { env });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.node.ok, true);
  assert.equal(payload.npm.available, true);
  assert.equal(payload.githubPackages.registryConfigured, true);
  assert.equal(payload.githubPackages.nodeAuthTokenEnv, true);
  assert.equal(payload.githubPackages.packageAccess.ok, true);
  assert.equal(payload.catalog.ok, true);

  const human = runCli(["doctor", "--catalog", catalogPath], { env });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Topogram doctor passed/);
  assert.match(human.stdout, /GitHub Packages registry: configured/);
  assert.match(human.stdout, /CLI package access: @attebury\/topogram@0\.2\.45 ok/);
  assert.match(human.stdout, /Catalog package access: ok/);

  const missingRegistry = runCli(["doctor", "--catalog", catalogPath, "--json"], {
    env: {
      ...env,
      FAKE_NPM_ATTEBURY_REGISTRY: "undefined"
    }
  });
  assert.notEqual(missingRegistry.status, 0, missingRegistry.stdout);
  const missingRegistryPayload = JSON.parse(missingRegistry.stdout);
  assert.equal(missingRegistryPayload.ok, false);
  assert.equal(
    missingRegistryPayload.diagnostics.some((diagnostic) => diagnostic.code === "github_packages_registry_not_configured"),
    true
  );
});

test("topogram catalog show describes template and topogram entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-show-"));
  const catalogPath = createCatalog(root, [
    catalogEntry(),
    catalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const template = runCli(["catalog", "show", "todo", "--catalog", catalogPath, "--json"]);
  assert.equal(template.status, 0, template.stderr || template.stdout);
  const templatePayload = JSON.parse(template.stdout);
  assert.equal(templatePayload.ok, true);
  assert.equal(templatePayload.entry.kind, "template");
  assert.equal(templatePayload.entry.package, "@scope/topogram-template-todo");
  assert.equal(templatePayload.packageSpec, "@scope/topogram-template-todo@0.1.0");
  assert.equal(
    templatePayload.commands.primary,
    `topogram new ./my-app --template todo --catalog ${catalogPath}`
  );

  const topogram = runCli(["catalog", "show", "hello", "--catalog", catalogPath, "--json"]);
  assert.equal(topogram.status, 0, topogram.stderr || topogram.stdout);
  const topogramPayload = JSON.parse(topogram.stdout);
  assert.equal(topogramPayload.ok, true);
  assert.equal(topogramPayload.entry.kind, "topogram");
  assert.equal(topogramPayload.packageSpec, "@scope/topogram-hello@0.1.0");
  assert.equal(
    topogramPayload.commands.primary,
    `topogram catalog copy hello ./hello-topogram --catalog ${catalogPath}`
  );
  assert.deepEqual(topogramPayload.commands.followUp, [
    "cd ./hello-topogram",
    "topogram source status",
    "topogram check",
    "topogram generate"
  ]);

  const human = runCli(["catalog", "show", "hello", "--catalog", catalogPath]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Catalog entry: hello/);
  assert.match(human.stdout, /Kind: topogram/);
  assert.match(human.stdout, /Action: copies editable Topogram source/);
  assert.match(human.stdout, /Executable implementation: no \(topogram entries cannot include implementation\/ in v1\)/);
  assert.match(human.stdout, /Recommended command:/);
  assert.match(human.stdout, /topogram catalog copy hello \.\/hello-topogram/);
  assert.match(human.stdout, /cd \.\/hello-topogram/);
  assert.match(human.stdout, /topogram source status/);
  assert.match(human.stdout, /topogram check/);
  assert.match(human.stdout, /topogram generate/);
  assert.match(human.stdout, /\.topogram-source\.json will record copy provenance only/);

  const missing = runCli(["catalog", "show", "missing", "--catalog", catalogPath, "--json"]);
  assert.notEqual(missing.status, 0, missing.stdout);
  const missingPayload = JSON.parse(missing.stdout);
  assert.equal(missingPayload.ok, false);
  assert.equal(missingPayload.diagnostics[0].code, "catalog_entry_not_found");
});

test("topogram template list includes catalog template aliases", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-template-list-"));
  const catalogPath = createCatalog(root, [
    catalogEntry(),
    catalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const list = runCli(["template", "list", "--json", "--catalog", catalogPath]);
  assert.equal(list.status, 0, list.stderr || list.stdout);
  const payload = JSON.parse(list.stdout);
  assert.equal(payload.catalog.loaded, true);
  assert.equal(payload.templates.some((template) => template.id === "topogram/hello-web" && template.source === "builtin"), true);
  assert.equal(payload.templates.some((template) => template.id === "topogram/web-api" && template.source === "builtin"), true);
  assert.equal(payload.templates.some((template) => template.id === "topogram/web-api-db" && template.source === "builtin"), true);
  const todoTemplate = payload.templates.find((template) => template.id === "todo");
  assert.ok(todoTemplate);
  assert.equal(todoTemplate.source, "catalog");
  assert.equal(todoTemplate.package, "@scope/topogram-template-todo");
  assert.equal(payload.templates.some((template) => template.id === "hello"), false);

  const listHuman = runCli(["template", "list", "--catalog", catalogPath]);
  assert.equal(listHuman.status, 0, listHuman.stderr || listHuman.stdout);
  assert.match(listHuman.stdout, /Template starters:/);
  assert.match(listHuman.stdout, /Built-ins are bundled with the CLI; catalog aliases resolve to versioned package installs/);
  assert.match(listHuman.stdout, /topogram\/hello-web@0\.1\.0 \(default\)/);
  assert.match(listHuman.stdout, /Source: builtin \| Surfaces: web \| Stack: Vanilla HTML\/CSS\/JS \| Executable implementation: no/);
  assert.match(listHuman.stdout, /todo@0\.1\.0/);
  assert.match(listHuman.stdout, /Source: catalog \| Surfaces: web, api, database \| Stack: SvelteKit \+ Hono \+ Postgres \| Executable implementation: yes/);
  assert.match(listHuman.stdout, /topogram new \.\/my-app --template todo/);

  const human = runCli(["catalog", "list", "--catalog", catalogPath]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Catalog entries:/);
  assert.match(human.stdout, /Template entries create starters with `topogram new`/);
  assert.match(human.stdout, /todo \(template\)/);
  assert.match(human.stdout, /Package: @scope\/topogram-template-todo@0\.1\.0/);
  assert.match(human.stdout, /Executable implementation: yes/);
  assert.match(human.stdout, /New: topogram new \.\/my-app --template todo/);
  assert.match(human.stdout, /hello \(topogram\)/);
  assert.match(human.stdout, /Copy: topogram catalog copy hello \.\/hello-topogram/);
});

test("topogram template show describes built-in and catalog templates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-show-"));
  const catalogPath = createCatalog(root, [
    catalogEntry(),
    catalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const builtin = runCli(["template", "show", "hello-web", "--json"]);
  assert.equal(builtin.status, 0, builtin.stderr || builtin.stdout);
  const builtinPayload = JSON.parse(builtin.stdout);
  assert.equal(builtinPayload.ok, true);
  assert.equal(builtinPayload.source, "builtin");
  assert.equal(builtinPayload.template.id, "topogram/hello-web");
  assert.equal(builtinPayload.template.description, "Vanilla HTML/CSS/JS starter with two pages and one workflow.");
  assert.equal(builtinPayload.template.isDefault, true);
  assert.equal(builtinPayload.template.stack, "Vanilla HTML/CSS/JS");
  assert.deepEqual(builtinPayload.template.generators, ["topogram/vanilla-web"]);
  assert.deepEqual(builtinPayload.template.surfaces, ["web"]);
  assert.deepEqual(builtinPayload.decision.surfaces, ["web"]);
  assert.equal(builtinPayload.decision.stack, "Vanilla HTML/CSS/JS");
  assert.deepEqual(builtinPayload.decision.generators, ["topogram/vanilla-web"]);
  assert.equal(builtinPayload.decision.packageSpec, null);
  assert.equal(builtinPayload.decision.executableImplementation, false);
  assert.equal(builtinPayload.commands.primary, "topogram new ./my-app --template hello-web");

  const builtinHuman = runCli(["template", "show", "web-api"]);
  assert.equal(builtinHuman.status, 0, builtinHuman.stderr || builtinHuman.stdout);
  assert.match(builtinHuman.stdout, /What it creates:/);
  assert.match(builtinHuman.stdout, /Stack: React \+ Express/);
  assert.match(builtinHuman.stdout, /Surfaces: web, api/);
  assert.match(builtinHuman.stdout, /Policy impact: Copies implementation\/ code/);

  const template = runCli(["template", "show", "todo", "--catalog", catalogPath, "--json"]);
  assert.equal(template.status, 0, template.stderr || template.stdout);
  const templatePayload = JSON.parse(template.stdout);
  assert.equal(templatePayload.ok, true);
  assert.equal(templatePayload.source, "catalog");
  assert.equal(templatePayload.template.kind, "template");
  assert.equal(templatePayload.packageSpec, "@scope/topogram-template-todo@0.1.0");
  assert.deepEqual(templatePayload.decision.surfaces, ["web", "api", "database"]);
  assert.equal(templatePayload.decision.stack, "SvelteKit + Hono + Postgres");
  assert.deepEqual(templatePayload.decision.generators, ["topogram/sveltekit", "topogram/hono", "topogram/postgres"]);
  assert.equal(templatePayload.decision.executableImplementation, true);
  assert.match(templatePayload.decision.policyImpact, /Copies implementation\/ code/);
  assert.equal(
    templatePayload.commands.primary,
    `topogram new ./my-app --template todo --catalog ${catalogPath}`
  );

  const human = runCli(["template", "show", "todo", "--catalog", catalogPath]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Template: todo/);
  assert.match(human.stdout, /Source: catalog/);
  assert.match(human.stdout, /What it creates:/);
  assert.match(human.stdout, /Surfaces: web, api, database/);
  assert.match(human.stdout, /Stack: SvelteKit \+ Hono \+ Postgres/);
  assert.match(human.stdout, /Package: @scope\/topogram-template-todo@0\.1\.0/);
  assert.match(human.stdout, /Policy impact: Copies implementation\/ code/);
  assert.doesNotMatch(human.stdout, /Details:\nStack:/);
  assert.match(human.stdout, /Recommended command:/);
  assert.match(human.stdout, /topogram new \.\/my-app --template todo/);

  const nonTemplate = runCli(["template", "show", "hello", "--catalog", catalogPath, "--json"]);
  assert.notEqual(nonTemplate.status, 0, nonTemplate.stdout);
  assert.equal(JSON.parse(nonTemplate.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_entry_not_template"), true);
});

test("topogram new resolves catalog template aliases to package specs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-new-"));
  const templateRoot = copyBuiltInTemplate(root, "todo-template");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.id = "@scope/topogram-template-todo";
  manifest.version = "0.1.0";
  writeJson(manifestPath, manifest);
  const catalogPath = createCatalog(root, [catalogEntry()]);
  const fakeNpmBin = createFakeNpm(root);
  const projectRoot = path.join(root, "starter");
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-template-todo@0.1.0": templateRoot
    }),
    TOPOGRAM_CLI_PACKAGE_SPEC: "@attebury/topogram@0.2.45",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const create = runCli(["new", projectRoot, "--template", "todo", "--catalog", catalogPath], { env });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: @scope\/topogram-template-todo/);
  assert.match(create.stdout, /Source: package/);
  assert.match(create.stdout, /Source spec: @scope\/topogram-template-todo@0\.1\.0/);
  assert.match(create.stdout, /Catalog: todo from /);
  assert.match(create.stdout, /Package: @scope\/topogram-template-todo@0\.1\.0/);
  assert.match(create.stdout, /Executable implementation: yes/);
  assert.match(create.stdout, /Policy: topogram\.template-policy\.json/);
  assert.match(create.stdout, /Trust: \.topogram-template-trust\.json/);
  assert.match(create.stdout, /npm run doctor/);
  assert.match(create.stdout, /npm run template:policy:explain/);
  assert.match(create.stdout, /npm run trust:status/);
  const projectConfig = readJson(path.join(projectRoot, "topogram.project.json"));
  assert.equal(projectConfig.template.id, "@scope/topogram-template-todo");
  assert.equal(projectConfig.template.source, "package");
  assert.equal(projectConfig.template.requested, "todo");
  assert.equal(projectConfig.template.sourceSpec, "@scope/topogram-template-todo@0.1.0");
  assert.deepEqual(projectConfig.template.catalog, {
    id: "todo",
    source: catalogPath,
    package: "@scope/topogram-template-todo",
    version: "0.1.0",
    packageSpec: "@scope/topogram-template-todo@0.1.0"
  });
  assert.equal(
    readText(path.join(projectRoot, ".npmrc")),
    "@attebury:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n"
  );
  assert.equal(projectConfig.template.includesExecutableImplementation, true);
  const fileManifest = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  assert.equal(fileManifest.template.requested, "todo");
  assert.deepEqual(fileManifest.template.catalog, projectConfig.template.catalog);
  const trustRecord = readJson(path.join(projectRoot, ".topogram-template-trust.json"));
  assert.equal(trustRecord.template.requested, "todo");
  assert.deepEqual(trustRecord.template.catalog, projectConfig.template.catalog);

  const status = runCli(["template", "status", "--json"], { cwd: projectRoot });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.template.requested, "todo");
  assert.deepEqual(statusPayload.template.catalog, projectConfig.template.catalog);

  const humanStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.equal(humanStatus.status, 0, humanStatus.stderr || humanStatus.stdout);
  assert.match(humanStatus.stdout, /Requested: todo/);
  assert.match(humanStatus.stdout, /Catalog: todo from /);
});

test("explicit catalogs can override built-in template names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-builtin-name-"));
  const templateRoot = copyBuiltInTemplate(root, "hello-web-template");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.id = "@scope/topogram-starter-hello-web";
  manifest.version = "0.1.0";
  writeJson(manifestPath, manifest);
  const catalogPath = createCatalog(root, [
    catalogEntry({
      id: "hello-web",
      package: "@scope/topogram-starter-hello-web",
      description: "Catalog hello web starter",
      surfaces: ["web"],
      generators: ["topogram/vanilla-web"],
      stack: "Vanilla HTML/CSS/JS",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: true
      }
    })
  ]);
  const fakeNpmBin = createFakeNpm(root);
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-starter-hello-web@0.1.0": templateRoot
    }),
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const catalogProjectRoot = path.join(root, "catalog-starter");
  const catalogCreate = runCli(["new", catalogProjectRoot, "--template", "hello-web", "--catalog", catalogPath], { env });
  assert.equal(catalogCreate.status, 0, catalogCreate.stderr || catalogCreate.stdout);
  assert.match(catalogCreate.stdout, /Template: @scope\/topogram-starter-hello-web/);
  assert.match(catalogCreate.stdout, /Source: package/);
  assert.match(catalogCreate.stdout, /Catalog: hello-web from /);
  assert.equal(readJson(path.join(catalogProjectRoot, "topogram.project.json")).template.catalog.id, "hello-web");

  const builtinProjectRoot = path.join(root, "builtin-starter");
  const builtinCreate = runCli(["new", builtinProjectRoot, "--template", "hello-web"], { env });
  assert.equal(builtinCreate.status, 0, builtinCreate.stderr || builtinCreate.stdout);
  assert.match(builtinCreate.stdout, /Template: topogram\/hello-web/);
  assert.match(builtinCreate.stdout, /Source: builtin/);
  assert.equal(readJson(path.join(builtinProjectRoot, "topogram.project.json")).template.catalog, undefined);
});

test("topogram new explains catalog alias resolution failures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-new-errors-"));
  const source = "github:attebury/topograms/topograms.catalog.json";
  const authGhBin = createFailingCommand(
    root,
    "gh",
    "gh: Requires authentication (HTTP 401)\n"
  );
  const auth = runCli(["new", path.join(root, "auth"), "--template", "todo", "--catalog", source], {
    env: { PATH: `${authGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(auth.status, 0, auth.stdout);
  assert.match(auth.stderr, /Catalog template alias 'todo' could not be resolved/);
  assert.match(auth.stderr, /Authentication is required to read private catalog/);
  assert.match(auth.stderr, /GITHUB_TOKEN or GH_TOKEN/);
  assert.match(auth.stderr, /NODE_AUTH_TOKEN/);

  const catalogPath = createCatalog(root, [
    catalogEntry({ id: "other", package: "@scope/topogram-template-other" })
  ]);
  const missing = runCli(["new", path.join(root, "missing"), "--template", "todo", "--catalog", catalogPath]);
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /No template entry named 'todo' was found in the catalog/);
  assert.match(missing.stderr, /topogram template list/);
  assert.match(missing.stderr, /@attebury\/topogram-template-todo@0\.1\.6/);
});

test("package-backed template installs explain private package auth failures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-auth-errors-"));
  const projectRoot = path.join(root, "starter");
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - unauthenticated: User cannot be authenticated with the token provided.\n"
  );
  const create = runCli(["new", projectRoot, "--template", "@attebury/topogram-template-todo@0.1.6"], {
    env: { PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /Authentication is required to install template package '@attebury\/topogram-template-todo@0\.1\.6'/);
  assert.match(create.stderr, /NODE_AUTH_TOKEN/);
  assert.match(create.stderr, /Manage Actions access/);
  assert.match(create.stderr, /topogram doctor/);

  const missingNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E404\nnpm error 404 Not Found - GET https://npm.pkg.github.com/@attebury%2ftopogram-template-todo - not_found\n"
  );
  const missing = runCli(["new", path.join(root, "missing"), "--template", "@attebury/topogram-template-todo@9.9.9"], {
    env: { PATH: `${missingNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /was not found, or the current token does not have access/);
  assert.match(missing.stderr, /Check the package name\/version/);
  assert.match(missing.stderr, /topogram doctor/);

  const forbiddenNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E403\nnpm error 403 Forbidden - permission denied\n"
  );
  const forbidden = runCli(["new", path.join(root, "forbidden"), "--template", "@attebury/topogram-template-todo@0.1.6"], {
    env: { PATH: `${forbiddenNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(forbidden.status, 0, forbidden.stdout);
  assert.match(forbidden.stderr, /Package access was denied while installing template package/);
  assert.match(forbidden.stderr, /Manage Actions access/);
  assert.match(forbidden.stderr, /topogram doctor/);

  const integrityNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code EINTEGRITY\nnpm error integrity checksum failed\n"
  );
  const integrity = runCli(["new", path.join(root, "integrity"), "--template", "@attebury/topogram-template-todo@0.1.6"], {
    env: { PATH: `${integrityNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(integrity.status, 0, integrity.stdout);
  assert.match(integrity.stderr, /Package integrity failed while installing template package/);
  assert.match(integrity.stderr, /published GitHub Packages tarball/);
});

test("private GitHub catalog failures explain auth and access setup", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-auth-errors-"));
  const source = "github:attebury/topograms/topograms.catalog.json";
  const authGhBin = createFailingCommand(
    root,
    "gh",
    "gh: Requires authentication (HTTP 401)\n"
  );
  const auth = runCli(["catalog", "list", "--catalog", source], {
    env: { PATH: `${authGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(auth.status, 0, auth.stdout);
  assert.match(auth.stderr, /Authentication is required to read private catalog/);
  assert.match(auth.stderr, /GITHUB_TOKEN or GH_TOKEN/);

  const missingGhBin = createFailingCommand(
    root,
    "gh",
    "gh: Not Found (HTTP 404)\n"
  );
  const missing = runCli(["catalog", "list", "--catalog", source], {
    env: { PATH: `${missingGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /Catalog source 'github:attebury\/topograms\/topograms\.catalog\.json' was not found/);
  assert.match(missing.stderr, /repository read access/);
});

test("topogram package update-cli updates consumer dependency and runs available checks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    scripts: {
      "cli:surface": "node -e true",
      "doctor": "node -e true",
      "catalog:show": "node -e true",
      "catalog:template-show": "node -e true",
      "check": "node -e true"
    },
    devDependencies: {
      "@attebury/topogram": "^0.2.32"
    }
  });
  writeJson(path.join(projectRoot, "package-lock.json"), {
    name: "consumer",
    lockfileVersion: 3,
    requires: true,
    packages: {}
  });
  const fakeNpmBin = createFakeNpm(root);
  const runLog = path.join(root, "npm-run.log");
  const update = runCli(["package", "update-cli", "0.2.37"], {
    cwd: projectRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      FAKE_NPM_RUN_LOG: runLog,
      NODE_AUTH_TOKEN: "test-token",
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(update.status, 0, update.stderr || update.stdout);
  assert.match(update.stdout, /Updated @attebury\/topogram to \^0\.2\.37/);
  assert.match(update.stdout, /Checks run: cli:surface, doctor, catalog:show, catalog:template-show, check/);
  assert.equal(readJson(path.join(projectRoot, "package.json")).devDependencies["@attebury/topogram"], "^0.2.37");
  assert.equal(readJson(path.join(projectRoot, "package-lock.json")).packages["node_modules/@attebury/topogram"].version, "0.2.37");
  assert.deepEqual(fs.readFileSync(runLog, "utf8").trim().split("\n"), [
    "cli:surface",
    "doctor",
    "catalog:show",
    "catalog:template-show",
    "check"
  ]);

  const minimalRoot = path.join(root, "minimal");
  fs.mkdirSync(minimalRoot, { recursive: true });
  writePackageJson(minimalRoot, { name: "minimal", private: true });
  const minimal = runCli(["package", "update-cli", "0.2.37", "--json"], {
    cwd: minimalRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      NODE_AUTH_TOKEN: "test-token",
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(minimal.status, 0, minimal.stderr || minimal.stdout);
  const minimalPayload = JSON.parse(minimal.stdout);
  assert.equal(minimalPayload.ok, true);
  assert.deepEqual(minimalPayload.scriptsRun, []);
  assert.deepEqual(minimalPayload.skippedScripts, ["cli:surface", "doctor", "catalog:show", "catalog:template-show", "check"]);
});

test("topogram package update-cli explains private package auth failures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-auth-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, { name: "consumer", private: true });
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - unauthenticated: User cannot be authenticated with the token provided.\n"
  );
  const update = runCli(["package", "update-cli", "0.2.37"], {
    cwd: projectRoot,
    env: { PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /Authentication is required to inspect @attebury\/topogram@0\.2\.37/);
  assert.match(update.stderr, /NODE_AUTH_TOKEN/);
  assert.match(update.stderr, /Manage Actions access/);
});

test("topogram catalog copy installs pure topogram packages and rejects implementation code", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-copy-"));
  const packageRoot = createPureTopogramPackage(root, "hello-topogram-package");
  const unsafePackageRoot = createPureTopogramPackage(root, "unsafe-topogram-package", { implementation: true });
  const catalogPath = createCatalog(root, [
    catalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    }),
    catalogEntry({
      id: "unsafe-package",
      kind: "topogram",
      package: "@scope/topogram-unsafe-package",
      defaultVersion: "0.1.0",
      description: "Unsafe topogram package",
      tags: ["unsafe"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);
  const fakeNpmBin = createFakeNpm(root);
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-hello@0.1.0": packageRoot,
      "@scope/topogram-unsafe-package@0.1.0": unsafePackageRoot
    }),
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const targetRoot = path.join(root, "copied");
  const humanTargetRoot = path.join(root, "copied-human");
  const humanCopy = runCli(["catalog", "copy", "hello", humanTargetRoot, "--catalog", catalogPath], { env });
  assert.equal(humanCopy.status, 0, humanCopy.stderr || humanCopy.stdout);
  assert.match(humanCopy.stdout, /Copied catalog topogram 'hello'/);
  assert.match(humanCopy.stdout, /Package: @scope\/topogram-hello@0\.1\.0/);
  assert.match(humanCopy.stdout, /Source provenance: .*\.topogram-source\.json/);
  assert.match(humanCopy.stdout, /Files: \d+/);
  assert.match(humanCopy.stdout, /\.topogram-source\.json records import provenance only\. Local edits are allowed\./);
  assert.match(humanCopy.stdout, /Next steps:/);
  assert.match(humanCopy.stdout, /topogram source status/);
  assert.match(humanCopy.stdout, /topogram check/);
  assert.match(humanCopy.stdout, /topogram generate/);
  assert.equal(fs.existsSync(path.join(humanTargetRoot, ".topogram-source.json")), true);

  const humanSourceStatus = runCli(["source", "status"], { cwd: humanTargetRoot });
  assert.equal(humanSourceStatus.status, 0, humanSourceStatus.stderr || humanSourceStatus.stdout);
  assert.match(humanSourceStatus.stdout, /Topogram source status: clean/);
  assert.match(humanSourceStatus.stdout, /Catalog: hello from /);
  assert.match(humanSourceStatus.stdout, /Package: @scope\/topogram-hello@0\.1\.0/);
  assert.match(humanSourceStatus.stdout, /Changed: 0/);
  assert.match(humanSourceStatus.stdout, /\.topogram-source\.json records import provenance only\. Local edits are allowed\./);
  assert.match(humanSourceStatus.stdout, /This status does not block `topogram check` or `topogram generate`\./);
  assert.match(humanSourceStatus.stdout, /Next: run `topogram check` or `topogram generate`\./);

  const copy = runCli(["catalog", "copy", "hello", targetRoot, "--catalog", catalogPath, "--json"], { env });
  assert.equal(copy.status, 0, copy.stderr || copy.stdout);
  const payload = JSON.parse(copy.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.packageSpec, "@scope/topogram-hello@0.1.0");
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "README.md")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-source.json")), true);
  assert.equal(payload.files.some((file) => file === "topogram.project.json"), true);
  assert.equal(payload.provenancePath, path.join(targetRoot, ".topogram-source.json"));

  const sourceRecord = readJson(path.join(targetRoot, ".topogram-source.json"));
  assert.equal(sourceRecord.kind, "topogram");
  assert.equal(sourceRecord.catalog.id, "hello");
  assert.equal(sourceRecord.catalog.source, catalogPath);
  assert.equal(sourceRecord.package.name, "@scope/topogram-hello");
  assert.equal(sourceRecord.package.version, "0.1.0");
  assert.equal(sourceRecord.package.spec, "@scope/topogram-hello@0.1.0");
  assert.equal(sourceRecord.trust.includesExecutableImplementation, false);
  assert.ok(sourceRecord.files.some((file) => file.path === "topogram.project.json" && /^[a-f0-9]{64}$/.test(file.sha256)));

  const cleanStatus = runCli(["source", "status", "--json"], { cwd: targetRoot });
  assert.equal(cleanStatus.status, 0, cleanStatus.stderr || cleanStatus.stdout);
  const cleanPayload = JSON.parse(cleanStatus.stdout);
  assert.equal(cleanPayload.exists, true);
  assert.equal(cleanPayload.status, "clean");
  assert.deepEqual(cleanPayload.content.changed, []);
  assert.deepEqual(cleanPayload.content.added, []);
  assert.deepEqual(cleanPayload.content.removed, []);

  fs.appendFileSync(path.join(targetRoot, "topogram", "entities", "entity-greeting.tg"), "\n# local edit\n", "utf8");
  fs.writeFileSync(path.join(targetRoot, "topogram", "entities", "entity-local-note.tg"), "# local note\n", "utf8");
  fs.rmSync(path.join(targetRoot, "README.md"));
  const changedStatus = runCli(["source", "status", "--json"], { cwd: targetRoot });
  assert.equal(changedStatus.status, 0, changedStatus.stderr || changedStatus.stdout);
  const changedPayload = JSON.parse(changedStatus.stdout);
  assert.equal(changedPayload.status, "changed");
  assert.deepEqual(changedPayload.content.changed, ["topogram/entities/entity-greeting.tg"]);
  assert.deepEqual(changedPayload.content.added, ["topogram/entities/entity-local-note.tg"]);
  assert.deepEqual(changedPayload.content.removed, ["README.md"]);

  const changedHumanStatus = runCli(["source", "status"], { cwd: targetRoot });
  assert.equal(changedHumanStatus.status, 0, changedHumanStatus.stderr || changedHumanStatus.stdout);
  assert.match(changedHumanStatus.stdout, /Topogram source status: changed/);
  assert.match(changedHumanStatus.stdout, /Changed: 1/);
  assert.match(changedHumanStatus.stdout, /Added: 1/);
  assert.match(changedHumanStatus.stdout, /Removed: 1/);
  assert.match(changedHumanStatus.stdout, /Next: review the listed files, then run `topogram check` and `topogram generate` when ready\./);

  const missingStatus = runCli(["source", "status", path.join(root, "no-provenance"), "--json"]);
  assert.equal(missingStatus.status, 0, missingStatus.stderr || missingStatus.stdout);
  const missingPayload = JSON.parse(missingStatus.stdout);
  assert.equal(missingPayload.exists, false);
  assert.equal(missingPayload.status, "missing");
  assert.match(missingPayload.diagnostics[0].message, /\.topogram-source\.json was not found/);

  const missingHumanStatus = runCli(["source", "status", path.join(root, "no-provenance")]);
  assert.equal(missingHumanStatus.status, 0, missingHumanStatus.stderr || missingHumanStatus.stdout);
  assert.match(missingHumanStatus.stdout, /Topogram source status: no provenance/);
  assert.match(missingHumanStatus.stdout, /\.topogram-source\.json was not found/);
  assert.match(missingHumanStatus.stdout, /Next: use `topogram catalog copy <id> <target>`/);

  const unsafeTarget = path.join(root, "unsafe-copy");
  const unsafe = runCli(["catalog", "copy", "unsafe-package", unsafeTarget, "--catalog", catalogPath], { env });
  assert.notEqual(unsafe.status, 0, unsafe.stdout);
  assert.match(unsafe.stderr, /contains implementation\/, which is not allowed/);
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
  assert.equal(JSON.parse(inspect.stdout).project.resolvedTopology.components.length, 1);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram new defaults to the hello-web starter", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-default-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/hello-web/);
  assert.match(create.stdout, /Source: builtin/);
  assert.match(create.stdout, /Executable implementation: no/);
  assert.match(create.stdout, /Policy: topogram\.template-policy\.json/);
  assert.match(create.stdout, /Template files: \.topogram-template-files\.json/);
  assert.doesNotMatch(create.stdout, /Trust: \.topogram-template-trust\.json/);
  assert.match(create.stdout, /npm run doctor/);
  assert.doesNotMatch(create.stdout, /npm run template:policy:explain/);
  assert.doesNotMatch(create.stdout, /npm run trust:status/);
  assert.equal(create.stderr, "");
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "docs", "workflows", "workflow-hello.md")), true);

  const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.project.json"), "utf8"));
  assert.equal(projectConfig.template.id, "topogram/hello-web");
  assert.equal(projectConfig.template.requested, "hello-web");
  assert.equal(projectConfig.template.includesExecutableImplementation, false);
  assert.equal(projectConfig.topology.components[0].generator.id, "topogram/vanilla-web");

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "web", "app_web", "index.html")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "web", "app_web", "workflow.html")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "services")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "db")), false);
});

test("built-in starter templates generate the expected surface layout", () => {
  const cases = [
    {
      template: "hello-api",
      present: ["app/apps/services/app_api"],
      absent: ["app/apps/web", "app/apps/db", "app/apps/services/app_api/prisma"]
    },
    {
      template: "hello-db",
      present: ["app/apps/db/app_sqlite"],
      absent: ["app/apps/web", "app/apps/services"]
    },
    {
      template: "web-api",
      present: ["app/apps/services/app_api", "app/apps/web/app_react"],
      absent: ["app/apps/db", "app/apps/services/app_api/prisma"]
    },
    {
      template: "web-api-db",
      present: ["app/apps/services/app_api", "app/apps/web/app_sveltekit", "app/apps/db/app_postgres"],
      absent: []
    }
  ];

  for (const item of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `topogram-${item.template}-`));
    const projectRoot = path.join(root, "starter");
    const create = runCli(["new", projectRoot, "--template", item.template]);
    assert.equal(create.status, 0, create.stderr || create.stdout);
    const generate = runCli(["generate"], { cwd: projectRoot });
    assert.equal(generate.status, 0, `${item.template}\n${generate.stderr || generate.stdout}`);
    for (const relativePath of item.present) {
      assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, `${item.template} expected ${relativePath}`);
    }
    for (const relativePath of item.absent) {
      assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), false, `${item.template} did not expect ${relativePath}`);
    }
  }
});

test("topogram new creates an executable web-api-db starter project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.match(create.stdout, /npm run doctor/);
  assert.match(create.stdout, /npm run check/);
  assert.match(create.stdout, /npm run generate/);

  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts.explain, "node ./scripts/explain.mjs");
  assert.equal(pkg.scripts.doctor, "topogram doctor");
  assert.equal(pkg.scripts.check, "topogram check");
  assert.equal(pkg.scripts["check:json"], "topogram check --json");
  assert.equal(pkg.scripts.generate, "topogram generate");
  assert.equal(pkg.scripts.status, undefined);
  assert.equal(pkg.scripts.inspect, undefined);
  assert.equal(pkg.scripts.build, undefined);
  assert.equal(pkg.devDependencies["@attebury/topogram"].startsWith("file:"), true);
  assert.equal(pkg.devDependencies.topogram, undefined);
  assert.equal(fs.existsSync(path.join(projectRoot, ".npmrc")), false);
  assert.equal(pkg.scripts["template:status"], "topogram template status");
  assert.equal(pkg.scripts["template:check"], undefined);
  assert.equal(pkg.scripts["template:policy:check"], "topogram template policy check");
  assert.equal(pkg.scripts["template:policy:explain"], "topogram template policy explain");
  assert.equal(pkg.scripts["template:update:status"], "topogram template update --status");
  assert.equal(pkg.scripts["template:update:recommend"], "topogram template update --recommend");
  assert.equal(pkg.scripts["template:update:plan"], "topogram template update --plan");
  assert.equal(pkg.scripts["template:update:check"], "topogram template update --check");
  assert.equal(pkg.scripts["template:update:apply"], "topogram template update --apply");
  assert.equal(pkg.scripts["trust:status"], "topogram trust status");
  assert.equal(pkg.scripts["trust:diff"], "topogram trust diff");
  assert.equal(pkg.scripts["app:compile"], "npm --prefix ./app run compile");
  assert.equal(pkg.scripts["app:smoke"], "npm --prefix ./app run smoke");
  assert.equal(pkg.scripts["app:runtime-check"], "npm --prefix ./app run runtime-check");
  assert.equal(pkg.scripts["app:check"], "npm run app:compile");
  assert.equal(pkg.scripts["app:probe"], "npm run app:smoke && npm run app:runtime-check");
  assert.equal(pkg.scripts["app:runtime"], "npm --prefix ./app run runtime");

  const doctor = runCli(["doctor", "--json"], { cwd: projectRoot });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.githubPackages.required, false);
  assert.equal(doctorPayload.githubPackages.packageAccess.ok, true);
  assert.equal(doctorPayload.catalog.ok, true);

  assert.match(create.stderr, /copied implementation\/ code/);
  assert.match(create.stdout, /Executable implementation: yes/);
  assert.match(create.stdout, /Policy: topogram\.template-policy\.json/);
  assert.match(create.stdout, /Trust: \.topogram-template-trust\.json/);
  assert.match(create.stdout, /npm run template:policy:explain/);
  assert.match(create.stdout, /npm run trust:status/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-task.tg")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.template-policy.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "scripts", "explain.mjs")), true);
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
  assert.match(readme, /Template: `topogram\/web-api-db@/);
  assert.match(readme, /Executable implementation: `yes`/);
  assert.match(readme, /npm run doctor/);
  assert.match(readme, /npm run template:policy:explain/);
  assert.match(readme, /npm run trust:status/);
  const explainScript = fs.readFileSync(path.join(projectRoot, "scripts", "explain.mjs"), "utf8");
  assert.match(explainScript, /npm run doctor/);
  assert.match(explainScript, /npm run template:policy:explain/);
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

  const builtinLatest = runCli(["template", "status", "--latest", "--json"], { cwd: projectRoot });
  assert.equal(builtinLatest.status, 0, builtinLatest.stderr || builtinLatest.stdout);
  const builtinLatestPayload = JSON.parse(builtinLatest.stdout);
  assert.equal(builtinLatestPayload.latest.checked, true);
  assert.equal(builtinLatestPayload.latest.supported, false);
  assert.match(builtinLatestPayload.latest.reason, /package-backed/);

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
  assert.match(explain.stdout, /npm run app:probe/);
  assert.match(explain.stdout, /npm run app:runtime/);

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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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

  const explain = runCli(["template", "policy", "explain", "--json"], { cwd: projectRoot });
  assert.equal(explain.status, 0, explain.stderr || explain.stdout);
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.ok, true);
  assert.equal(explainPayload.template.id, "topogram/web-api-db");
  assert.equal(explainPayload.rules.some((rule) => rule.name === "allowed-template-id" && rule.ok), true);

  const humanExplain = runCli(["template", "policy", "explain"], { cwd: projectRoot });
  assert.equal(humanExplain.status, 0, humanExplain.stderr || humanExplain.stdout);
  assert.match(humanExplain.stdout, /Template policy explain: allowed/);
  assert.match(humanExplain.stdout, /PASS allowed-template-id/);
});

test("topogram template policy pin records a reviewed template version", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-pin-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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

test("package-backed templates can inspect and recommend latest versions explicitly", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-latest-"));
  const initialTemplateRoot = copyBuiltInTemplate(root, "template-initial");
  const latestTemplateRoot = copyBuiltInTemplate(root, "template-latest");
  const projectRoot = path.join(root, "starter");
  for (const [templateRoot, version] of [[initialTemplateRoot, "0.1.0"], [latestTemplateRoot, "0.2.0"]]) {
    const manifestPath = path.join(templateRoot, "topogram-template.json");
    const manifest = readJson(manifestPath);
    manifest.id = "@scope/topogram-template-latest";
    manifest.version = version;
    writeJson(manifestPath, manifest);
  }
  fs.appendFileSync(
    path.join(latestTemplateRoot, "topogram", "entities", "entity-greeting.tg"),
    "\n# latest package edit\n",
    "utf8"
  );
  const fakeNpmBin = createFakeNpm(root);
  const env = {
    FAKE_TEMPLATE_INITIAL: initialTemplateRoot,
    FAKE_TEMPLATE_LATEST: latestTemplateRoot,
    FAKE_NPM_LATEST_VERSION: "0.2.0",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const create = runCli(["new", projectRoot, "--template", "@scope/topogram-template-latest@0.1.0"], { env });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const status = runCli(["template", "status", "--latest", "--json"], { cwd: projectRoot, env });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.latest.checked, true);
  assert.equal(statusPayload.latest.supported, true);
  assert.equal(statusPayload.latest.version, "0.2.0");
  assert.equal(statusPayload.latest.candidateSpec, "@scope/topogram-template-latest@0.2.0");
  assert.equal(statusPayload.latest.isCurrent, false);

  const recommend = runCli(["template", "update", "--recommend", "--latest", "--json"], { cwd: projectRoot, env });
  assert.equal(recommend.status, 0, recommend.stderr || recommend.stdout);
  const recommendPayload = JSON.parse(recommend.stdout);
  assert.equal(recommendPayload.mode, "recommend");
  assert.equal(recommendPayload.candidate.version, "0.2.0");
  assert.equal(recommendPayload.recommendations.some((item) => item.command === "topogram template update --apply"), true);
});

test("topogram template update emits a non-writing update plan", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-plan-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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

test("topogram template policy explain checks package scope from source spec", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-explain-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.template.id = "@attebury/topogram-template-todo";
  projectConfig.template.version = "0.1.6";
  projectConfig.template.source = "package";
  projectConfig.template.requested = "todo";
  projectConfig.template.sourceSpec = "@evil/topogram-template-todo@0.1.6";
  projectConfig.template.catalog = {
    id: "todo",
    source: "./topograms.catalog.json",
    package: "@evil/topogram-template-todo",
    version: "0.1.6",
    packageSpec: "@evil/topogram-template-todo@0.1.6"
  };
  writeJson(projectConfigPath, projectConfig);

  const policyPath = path.join(projectRoot, "topogram.template-policy.json");
  const policy = readJson(policyPath);
  policy.allowedTemplateIds = ["@attebury/topogram-template-todo"];
  policy.allowedPackageScopes = ["@attebury"];
  policy.executableImplementation = "allow";
  policy.pinnedVersions = { "@attebury/topogram-template-todo": "0.1.6" };
  writeJson(policyPath, policy);

  const check = runCli(["template", "policy", "check", "--json"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_package_scope_denied"), true);

  const explain = runCli(["template", "policy", "explain", "--json"], { cwd: projectRoot });
  assert.notEqual(explain.status, 0, explain.stdout);
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.package.scope, "@evil");
  assert.equal(explainPayload.catalog.packageSpec, "@evil/topogram-template-todo@0.1.6");
  const scopeRule = explainPayload.rules.find((rule) => rule.name === "allowed-package-scope");
  assert.equal(scopeRule.ok, false);
  assert.equal(scopeRule.actual, "@evil");
  assert.equal(scopeRule.expected, "@attebury");
});

test("topogram template check enforces caller template policy when present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-policy-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  const create = runCli(["new", projectRoot, "--template", "web-api-db"]);
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
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "docs", "workflows", "workflow-hello.md")), true);
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
