// @ts-check

import path from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATE_FILES_MANIFEST = ".topogram-template-files.json";
export const TEMPLATE_POLICY_FILE = "topogram.template-policy.json";
export const ENGINE_ROOT = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
export const TEMPLATES_ROOT = path.join(ENGINE_ROOT, "templates");
