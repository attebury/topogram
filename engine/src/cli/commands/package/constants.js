// @ts-check

import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLI_PACKAGE_NAME = "@topogram/cli";
export const NPMJS_REGISTRY = "https://registry.npmjs.org";

export const PACKAGE_UPDATE_CLI_CHECK_SCRIPTS = [
  "cli:surface",
  "doctor",
  "catalog:show",
  "catalog:template-show",
  "check",
  "pack:check",
  "verify"
];
export const PACKAGE_UPDATE_CLI_INFO_SCRIPTS = ["cli:surface", "doctor", "catalog:show", "catalog:template-show"];
export const PACKAGE_UPDATE_CLI_VERIFICATION_SCRIPTS = ["verify", "pack:check", "check"];
export const ENGINE_ROOT = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
