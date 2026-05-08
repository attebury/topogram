import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildWebRealization } from "../../../realization/ui/build-web-realization.js";
import { pickDefaultIosUiProjection, pickDefaultUiWebProjection } from "../../runtime/shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Emits a SwiftPM iOS SwiftUI app driven by the routed UI contract (default: `proj_ios_surface__swiftui` when present, else first `proj_web_surface__*` projection).
 */
export function generateSwiftUiApp(graph, options = {}) {
  const fallbackId =
    pickDefaultIosUiProjection(graph)?.id ||
    pickDefaultUiWebProjection(graph)?.id ||
    "proj_web_surface__sveltekit";
  const projectionId = options.projectionId || fallbackId;
  const realization = buildWebRealization(graph, { projectionId });
  const apiContracts = realization.apiContracts;
  const contractJson = `${JSON.stringify(realization.contract, null, 2)}\n`;
  const apiJson = `${JSON.stringify(apiContracts, null, 2)}\n`;

  const runtimeDir = path.join(__dirname, "swiftui-templates", "runtime");
  const swiftFiles = fs.readdirSync(runtimeDir).filter((f) => f.endsWith(".swift"));
  const files = {};

  for (const name of swiftFiles) {
    files[`Sources/TopogramSwiftUIApp/${name}`] = fs.readFileSync(path.join(runtimeDir, name), "utf8");
  }

  files["Package.swift"] = fs.readFileSync(path.join(__dirname, "swiftui-templates", "Package.swift.txt"), "utf8");
  files["README.md"] = fs.readFileSync(path.join(__dirname, "swiftui-templates", "README.generated.md"), "utf8");
  files["Sources/TopogramSwiftUIApp/Resources/ui-surface-contract.json"] = contractJson;
  files["Sources/TopogramSwiftUIApp/Resources/api-contracts.json"] = apiJson;

  return files;
}
