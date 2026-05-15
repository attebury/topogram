// `sdlc new <kind> <slug>` — scaffold a new SDLC `.tg` file with sensible
// defaults so the author can fill in details rather than start blank.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sdlcRootForSdlc } from "./paths.js";

const TEMPLATES = {
  pitch: (slug) => `pitch pitch_${slug} {
  name "${humanize(slug)}"
  description "Why this work matters."
  appetite "TBD — small / medium / large"
  problem "Describe the user-visible problem."
  solution_sketch "Describe the proposed shape, not the implementation."
  rabbit_holes "Known traps to avoid."
  no_go_areas "Things this pitch deliberately won't touch."
  affects []
  priority medium
  status draft
}
`,
  requirement: (slug) => `requirement req_${slug} {
  name "${humanize(slug)}"
  description "What the system must do."
  affects []
  introduces_rules []
  respects_rules []
  priority medium
  status draft
}
`,
  acceptance_criterion: (slug) => `acceptance_criterion ac_${slug} {
  name "${humanize(slug)}"
  description "Given <state>, when <action>, then <observable outcome>."
  requirement req_TODO
  status draft
}
`,
  task: (slug) => `task task_${slug} {
  name "${humanize(slug)}"
  description "What the agent or human will do."
  satisfies []
  acceptance_refs []
  verification_refs []
  affects []
  blocked_by []
  disposition active
  priority medium
  work_type implementation
  status unclaimed
}
`,
  bug: (slug) => `bug bug_${slug} {
  name "${humanize(slug)}"
  description "What goes wrong."
  reproduction "Steps to reproduce."
  affects []
  violates []
  priority medium
  severity medium
  status open
}
`
};

function humanize(slug) {
  return slug
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function scaffoldNew(workspaceRoot, kind, slug) {
  if (!TEMPLATES[kind]) {
    return { ok: false, error: `Unsupported kind '${kind}' (allowed: ${Object.keys(TEMPLATES).join(", ")})` };
  }
  if (!slug || !/^[a-z][a-z0-9_]*$/.test(slug)) {
    return { ok: false, error: `Invalid slug '${slug}' — must match /^[a-z][a-z0-9_]*$/` };
  }
  const targetDir = path.join(sdlcRootForSdlc(workspaceRoot), `${kind === "acceptance_criterion" ? "acceptance_criteria" : kind + "s"}`);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, `${slug}.tg`);
  if (existsSync(targetFile)) {
    return { ok: false, error: `Refusing to overwrite '${targetFile}'` };
  }
  writeFileSync(targetFile, TEMPLATES[kind](slug), "utf8");
  return {
    ok: true,
    kind,
    slug,
    file: targetFile
  };
}
