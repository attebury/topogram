import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { generateSwiftUiApp } from "../../src/generator/apps/ios/swiftui-app.js";
import { buildWebRealization } from "../../src/realization/ui/index.js";
import { fingerprintIosEmbeddedUiContract } from "../../src/proofs/ios-parity.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const todoPath = path.join(repoRoot, "examples", "generated", "todo", "topogram");

test("swiftui-app emits Swift sources and identical ui-web-contract fingerprint", () => {
  const ast = parsePath(todoPath);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);

  const realization = buildWebRealization(resolved.graph, { projectionId: "proj_ui_web__sveltekit" });
  const files = generateSwiftUiApp(resolved.graph, { projectionId: "proj_ui_web__sveltekit" });

  assert.ok(files["Package.swift"]);
  assert.ok(files["Sources/TodoSwiftUIApp/TodoSwiftUIApp.swift"]);
  assert.ok(files["Sources/TodoSwiftUIApp/TodoAPIClient.swift"]);
  assert.ok(files["Sources/TodoSwiftUIApp/DynamicScreens.swift"]);

  const embedded = JSON.parse(files["Sources/TodoSwiftUIApp/Resources/ui-web-contract.json"]);
  assert.equal(
    fingerprintIosEmbeddedUiContract(embedded),
    fingerprintIosEmbeddedUiContract(realization.contract)
  );
});
