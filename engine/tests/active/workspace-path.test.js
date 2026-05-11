import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveTopoRoot,
  resolveWorkspaceContext
} from "../../src/workspace-paths.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "topogram-workspace-path."));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeTg(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'actor actor_user {\n  name "User"\n}\n', "utf8");
}

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8"
  });
}

test("resolves explicit topo workspace and default project workspace", () => {
  const root = tempRoot();
  writeTg(path.join(root, "topo", "actors", "actor-user.tg"));
  assert.equal(resolveTopoRoot(path.join(root, "topo")), path.join(root, "topo"));
  assert.equal(resolveTopoRoot(root), path.join(root, "topo"));
});

test("resolves configured workspace path and workspace dot", () => {
  const root = tempRoot();
  writeJson(path.join(root, "topogram.project.json"), { version: "0.1", workspace: "./model" });
  writeTg(path.join(root, "model", "actors", "actor-user.tg"));
  assert.equal(resolveTopoRoot(root), path.join(root, "model"));

  const packageRoot = tempRoot();
  writeJson(path.join(packageRoot, "topogram.project.json"), { version: "0.1", workspace: "." });
  writeTg(path.join(packageRoot, "actors", "actor-user.tg"));
  assert.equal(resolveTopoRoot(packageRoot), packageRoot);
});

test("uses bounded signal scan and errors on ambiguous candidates", () => {
  const root = tempRoot();
  writeTg(path.join(root, "model", "actors", "actor-user.tg"));
  assert.equal(resolveWorkspaceContext(root).topoRoot, path.join(root, "model"));

  writeTg(path.join(root, "other", "actors", "actor-other.tg"));
  assert.throws(() => resolveTopoRoot(root), /Multiple Topogram workspace candidates/);
});

test("missing config-less workspace points at default topo bootstrap path", () => {
  const root = tempRoot();
  const context = resolveWorkspaceContext(root);
  assert.equal(context.topoRoot, path.join(root, "topo"));
  assert.equal(context.bootstrappedTopoRoot, true);
});

test("legacy topogram folders are not accepted as workspaces", () => {
  const root = tempRoot();
  writeTg(path.join(root, "topogram", "actors", "actor-user.tg"));

  const context = resolveWorkspaceContext(root);
  assert.equal(context.topoRoot, path.join(root, "topo"));
  assert.equal(context.bootstrappedTopoRoot, true);
  assert.throws(
    () => resolveTopoRoot(path.join(root, "topogram")),
    /Legacy workspace folders are not supported/
  );
});

test("project config rejects legacy workspace paths", () => {
  const root = tempRoot();
  writeJson(path.join(root, "topogram.project.json"), { version: "0.1", workspace: "./topogram" });
  writeTg(path.join(root, "topogram", "actors", "actor-user.tg"));

  assert.throws(
    () => resolveTopoRoot(root),
    /workspace must use \.\/topo/
  );
});

test("migrate workspace-folder command is removed", () => {
  const root = tempRoot();
  writeTg(path.join(root, "topogram", "actors", "actor-user.tg"));

  const result = runCli(["migrate", "workspace-folder", root, "--write", "--json"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /migrate workspace-folder.*removed/);
  assert.match(result.stderr, /topo\//);
});
