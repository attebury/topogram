import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  LOCAL_NPMRC_ENV,
  assertSafeNpmSpec,
  localNpmrcEnv,
  localNpmrcStatus
} from "../../src/npm-safety.js";
import { nodeVersionSupport } from "../../src/runtime-support.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const engineRoot = path.join(repoRoot, "engine");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureTemplatesRoot = path.join(engineRoot, "tests", "fixtures", "templates");

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: options.env?.PATH || process.env.PATH || ""
    }
  });
}

test("npm package specs reject shell-like unsafe input before npm is called", () => {
  for (const spec of ["", "   ", "--ignore-scripts", "-w", "pkg name", "pkg\nname", "pkg\0name"]) {
    assert.throws(() => assertSafeNpmSpec(spec), /npm package spec|Invalid characters|starting with/);
  }

  assert.equal(assertSafeNpmSpec("@topogram/cli@0.0.1"), "@topogram/cli@0.0.1");
  assert.equal(assertSafeNpmSpec("file:../package.tgz"), "file:../package.tgz");
});

test("local .npmrc is ignored unless explicitly enabled", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-npmrc-safety-"));
  fs.writeFileSync(path.join(root, ".npmrc"), "@topogram:registry=https://example.invalid/\n", "utf8");
  const previousAllow = process.env[LOCAL_NPMRC_ENV];
  const previousUserconfig = process.env.NPM_CONFIG_USERCONFIG;
  try {
    delete process.env[LOCAL_NPMRC_ENV];
    delete process.env.NPM_CONFIG_USERCONFIG;
    assert.deepEqual(localNpmrcEnv(root), {});
    assert.equal(localNpmrcStatus(root).enabled, false);

    process.env[LOCAL_NPMRC_ENV] = "1";
    assert.equal(localNpmrcEnv(root).NPM_CONFIG_USERCONFIG, path.join(root, ".npmrc"));
    assert.equal(localNpmrcStatus(root).enabled, true);

    process.env.NPM_CONFIG_USERCONFIG = path.join(root, "global.npmrc");
    assert.deepEqual(localNpmrcEnv(root), {});
    assert.equal(localNpmrcStatus(root).reason, "NPM_CONFIG_USERCONFIG is already set explicitly.");
  } finally {
    if (previousAllow == null) {
      delete process.env[LOCAL_NPMRC_ENV];
    } else {
      process.env[LOCAL_NPMRC_ENV] = previousAllow;
    }
    if (previousUserconfig == null) {
      delete process.env.NPM_CONFIG_USERCONFIG;
    } else {
      process.env.NPM_CONFIG_USERCONFIG = previousUserconfig;
    }
  }
});

test("runtime support requires Node 20 or newer", () => {
  assert.equal(nodeVersionSupport("18.19.0").ok, false);
  assert.equal(nodeVersionSupport("20.0.0").ok, true);
  assert.equal(nodeVersionSupport("24.11.1").ok, true);
});

test("vanilla web generator escapes semantic UI text in generated HTML", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-vanilla-escape-"));
  const templateRoot = path.join(root, "template");
  fs.cpSync(path.join(fixtureTemplatesRoot, "hello-web"), templateRoot, { recursive: true });
  const projectionPath = path.join(templateRoot, "topo", "projections", "proj-ui-contract.tg");
  const original = fs.readFileSync(projectionPath, "utf8");
  const modified = original
    .replace('title "Hello Web"', 'title "Hello <script>alert(1)</script> & friends"')
    .replace('title "Hello Workflow"', 'title "Workflow <img src=x onerror=alert(1)>"');
  fs.writeFileSync(projectionPath, modified, "utf8");

  const projectRoot = path.join(root, "project");
  const create = runCli(["new", projectRoot, "--template", templateRoot], {
    cwd: root,
    env: {
      TOPOGRAM_CATALOG_SOURCE: "none",
      TOPOGRAM_CLI_PACKAGE_SPEC: `file:${engineRoot}`
    }
  });
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const generate = runCli(["generate", "--out", path.join(projectRoot, "app")], {
    cwd: projectRoot,
    env: {
      TOPOGRAM_CATALOG_SOURCE: "none"
    }
  });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const html = fs.readFileSync(path.join(projectRoot, "app", "apps", "web", "app_web", "index.html"), "utf8");
  assert.match(html, /Hello &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; friends/);
  assert.match(html, /Workflow &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
});
