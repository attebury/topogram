import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const issuesTopogramPath = path.join(repoRoot, "examples", "generated", "issues", "topogram");

test("native-parity-bundle emits Android Gradle tree, Swift package, and plan", () => {
  const parsed = parsePath(issuesTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "native-parity-bundle"
  });

  assert.equal(result.ok, true);
  assert.equal(result.target, "native-parity-bundle");
  const artifact = result.artifact;
  assert.ok(artifact["native-parity-plan.json"]);
  assert.ok(artifact["README.md"]);
  assert.ok(/native parity/i.test(artifact["README.md"]));
  assert.ok(artifact["android/settings.gradle.kts"]);
  assert.ok(artifact["android/app/build.gradle.kts"]);
  assert.ok(artifact["android/gradle/libs.versions.toml"]);
  assert.match(
    artifact["android/app/src/main/java/io/topogram/nativeparity/MainActivity.kt"],
    /ParityConfig\.API_BASE_URL/
  );
  assert.ok(artifact["ios/Package.swift"]);
  assert.ok(artifact["ios/Sources/TopogramNativeParity/ParityConfig.swift"]);
  assert.match(artifact["ios/Sources/TopogramNativeParity/ParityConfig.swift"], /URL\(string:/);

  const plan = JSON.parse(artifact["native-parity-plan.json"]);
  assert.equal(plan.type, "native_parity_plan");
  assert.ok(plan.resolved_urls?.PUBLIC_TOPOGRAM_API_BASE_URL);
  assert.ok(plan.projections?.api);
});

test("native-parity-plan returns typed plan object", () => {
  const parsed = parsePath(issuesTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "native-parity-plan"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.type, "native_parity_plan");
  assert.ok(result.artifact.pinned_toolchains);
});
