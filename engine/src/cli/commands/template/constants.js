// @ts-check

import path from "node:path";

export const TEMPLATE_FILES_MANIFEST = ".topogram-template-files.json";
export const TEMPLATE_POLICY_FILE = "topogram.template-policy.json";
export const ENGINE_ROOT = decodeURIComponent(new URL("../../../../", import.meta.url).pathname);
export const TEMPLATES_ROOT = path.join(ENGINE_ROOT, "templates");
