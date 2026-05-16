// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../format.js";
import { EXTRACTOR_TRACKS } from "./registry.js";

const DEFAULT_TRACK = "cli";

/**
 * @typedef {Object} ExtractorScaffoldOptions
 * @property {string|null|undefined} [packageName]
 * @property {string|null|undefined} [manifestId]
 * @property {string|null|undefined} [track]
 */

/**
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
  return String(value || "extractor")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "extractor";
}

/**
 * @param {string} target
 * @returns {string}
 */
function defaultPackageName(target) {
  const basename = slugify(path.basename(path.resolve(target)));
  return basename.startsWith("topogram-extractor-") ? basename : `topogram-extractor-${basename}`;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidPackageName(value) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
}

/**
 * @returns {string}
 */
function currentCliVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    return typeof packageJson.version === "string" && packageJson.version ? packageJson.version : "latest";
  } catch {
    return "latest";
  }
}

/**
 * @param {string} packageName
 * @param {string} track
 * @returns {string}
 */
function extractorId(packageName, track) {
  const bareName = packageName.split("/").pop() || packageName;
  return `${track}.${slugify(bareName.replace(/^topogram-extractor-/, "").replace(/^extractor-/, ""))}`;
}

/**
 * @param {string} track
 * @returns {{ stack: Record<string, string>, capabilities: Record<string, boolean>, candidateKinds: string[], fixtureFiles: Record<string, string> }}
 */
function trackDefaults(track) {
  if (track === "db") {
    return {
      stack: { domain: "database", framework: "scaffold" },
      capabilities: { schema: true },
      candidateKinds: ["entity"],
      fixtureFiles: {
        "package.json": `${stableStringify({ name: "topogram-extractor-fixture-db", private: true })}\n`,
        "src/schema.sql": "create table scaffold_records (id text primary key, name text not null);\n"
      }
    };
  }
  if (track === "api") {
    return {
      stack: { runtime: "node", framework: "scaffold" },
      capabilities: { routes: true },
      candidateKinds: ["capability", "route", "stack"],
      fixtureFiles: {
        "package.json": `${stableStringify({ name: "topogram-extractor-fixture-api", private: true })}\n`,
        "src/server.js": "app.get('/scaffold-records', listScaffoldRecords);\n"
      }
    };
  }
  if (track === "ui") {
    return {
      stack: { framework: "scaffold-ui" },
      capabilities: { screens: true, flows: true },
      candidateKinds: ["screen", "route", "flow"],
      fixtureFiles: {
        "package.json": `${stableStringify({ name: "topogram-extractor-fixture-ui", private: true })}\n`,
        "src/routes/scaffold-records.jsx": "export default function ScaffoldRecords() { return <main>Scaffold records</main>; }\n"
      }
    };
  }
  if (track === "workflows") {
    return {
      stack: { domain: "workflow" },
      capabilities: { workflows: true },
      candidateKinds: ["workflow"],
      fixtureFiles: {
        "package.json": `${stableStringify({ name: "topogram-extractor-fixture-workflows", private: true })}\n`,
        "docs/workflows.md": "# Scaffold workflow\n\n- draft\n- review\n- complete\n"
      }
    };
  }
  if (track === "verification") {
    return {
      stack: { domain: "verification" },
      capabilities: { verifications: true },
      candidateKinds: ["verification"],
      fixtureFiles: {
        "package.json": `${stableStringify({ name: "topogram-extractor-fixture-verification", private: true, scripts: { test: "node test.js" } })}\n`,
        "test.js": "console.log('scaffold verification fixture');\n"
      }
    };
  }
  return {
    stack: { runtime: "node", framework: "generic-cli" },
    capabilities: { commands: true, options: true, effects: true },
    candidateKinds: ["command", "capability", "cli_surface"],
    fixtureFiles: {
      "package.json": `${stableStringify({ name: "topogram-extractor-fixture-cli", private: true, bin: { scaffold: "./bin/scaffold.js" } })}\n`,
      "bin/scaffold.js": "#!/usr/bin/env node\nconsole.log('Usage: scaffold check --json');\n"
    }
  };
}

/**
 * @param {string} track
 * @returns {string}
 */
function candidateSourceForTrack(track) {
  if (track === "db") {
    return `{
        entities: [{
          id_hint: "entity_scaffold_record",
          label: "Scaffold Record",
          confidence: "low",
          provenance: ["package-extractor-scaffold"],
          fields: [{ name: "id", field_type: "string", required: true }]
        }]
      }`;
  }
  if (track === "api") {
    return `{
        capabilities: [{
          id_hint: "cap_list_scaffold_records",
          label: "List scaffold records",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }],
        routes: [{
          method: "GET",
          path: "/scaffold-records",
          capability_hint: "cap_list_scaffold_records",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }],
        stacks: ["scaffold-api"]
      }`;
  }
  if (track === "ui") {
    return `{
        screens: [{
          id_hint: "screen_scaffold_records",
          label: "Scaffold Records",
          screen_kind: "list",
          route_path: "/scaffold-records",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }],
        routes: [{
          id_hint: "route_scaffold_records",
          path: "/scaffold-records",
          screen_id: "screen_scaffold_records",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }],
        flows: [],
        stacks: ["scaffold-ui"]
      }`;
  }
  if (track === "workflows") {
    return `{
        workflows: [{
          id_hint: "workflow_scaffold_review",
          label: "Scaffold Review",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }]
      }`;
  }
  if (track === "verification") {
    return `{
        verifications: [{
          id_hint: "verification_scaffold_check",
          label: "Scaffold Check",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }],
        frameworks: ["scaffold"],
        scripts: [{
          id_hint: "script_scaffold_check",
          command: "npm test",
          confidence: "low",
          provenance: ["package-extractor-scaffold"]
        }]
      }`;
  }
  return `{
        commands: [{
          command_id: "scaffold_check",
          label: "Scaffold Check",
          usage: "scaffold check --json",
          provenance: ["package-extractor-scaffold"]
        }],
        capabilities: [{
          id_hint: "cap_scaffold_check",
          label: "Run scaffold check",
          command_id: "scaffold_check",
          provenance: ["package-extractor-scaffold"]
        }],
        surfaces: [{
          id_hint: "proj_cli_surface",
          commands: ["scaffold_check"],
          options: [{ command_id: "scaffold_check", name: "json", flag: "--json", type: "boolean", required: false }],
          effects: [{ command_id: "scaffold_check", effect: "read_only" }],
          provenance: ["package-extractor-scaffold"]
        }]
      }`;
}

/**
 * @param {string} track
 * @param {string} extractor
 * @returns {string}
 */
function adapterSource(track, extractor) {
  return `const manifest = require("./topogram-extractor.json");

exports.manifest = manifest;
exports.extractors = [{
  id: ${JSON.stringify(extractor)},
  track: ${JSON.stringify(track)},
  detect(context) {
    return { score: 1, reasons: ["Scaffold extractor runs against the included fixture."] };
  },
  extract(context) {
    return {
      findings: [{
        kind: "scaffold_finding",
        message: "Replace this scaffold extractor with precise framework evidence.",
        evidence: ["fixtures/basic-source"]
      }],
      candidates: ${candidateSourceForTrack(track)},
      diagnostics: []
    };
  }
}];
`;
}

/**
 * @param {string} packageName
 * @param {string} track
 * @returns {string}
 */
function checkScriptSource(packageName, track) {
  return `import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageName = packageJson.name || ${JSON.stringify(packageName)};
const track = ${JSON.stringify(track)};
const topogramBin = process.env.TOPOGRAM_CLI || process.env.TOPOGRAM_BIN || "topogram";
const root = process.cwd();

function run(args, options = {}) {
  const result = childProcess.spawnSync(topogramBin, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    maxBuffer: 1024 * 1024 * 10
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(\`Command failed: \${topogramBin} \${args.join(" ")}\`);
  }
  return result.stdout;
}

function snapshotFixture() {
  const fixtureRoot = path.join(root, "fixtures", "basic-source");
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push([path.relative(fixtureRoot, absolute), fs.readFileSync(absolute, "utf8")]);
    }
  }
  visit(fixtureRoot);
  return JSON.stringify(files.sort());
}

run(["extractor", "check", "."]);

const before = snapshotFixture();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-smoke."));
const policyPath = path.join(tmp, "topogram.extractor-policy.json");
fs.writeFileSync(policyPath, JSON.stringify({
  version: "0.1",
  allowedPackageScopes: [],
  allowedPackages: [packageName],
  pinnedVersions: { [packageName]: "1" },
  enabledPackages: []
}, null, 2) + "\\n", "utf8");

const extracted = path.join(tmp, "extracted");
run([
  "extract",
  path.join(root, "fixtures", "basic-source"),
  "--out",
  extracted,
  "--from",
  track,
  "--extractor",
  ".",
  "--extractor-policy",
  policyPath,
  "--json"
]);
run(["extract", "plan", extracted, "--json"]);
run(["query", "extract-plan", path.join(extracted, "topo"), "--json"]);
run(["adopt", "--list", extracted, "--json"]);

const after = snapshotFixture();
if (after !== before) {
  throw new Error("Extractor smoke mutated fixture source files.");
}

console.log(\`Extractor package smoke passed for \${packageName}.\`);
`;
}

/**
 * @param {Record<string, string>} files
 * @returns {string[]}
 */
function writeFiles(files) {
  const written = [];
  for (const [filePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
    written.push(filePath);
  }
  return written.sort();
}

/**
 * @param {string} target
 * @param {ExtractorScaffoldOptions} [options]
 * @returns {{ ok: boolean, target: string, packageName: string|null, manifestId: string|null, track: string|null, files: string[], nextCommands: string[], errors: string[] }}
 */
export function scaffoldExtractorPack(target, options = {}) {
  const absoluteTarget = path.resolve(target || "");
  if (!target || target.startsWith("-")) {
    return { ok: false, target: absoluteTarget, packageName: null, manifestId: null, track: null, files: [], nextCommands: [], errors: ["Usage: topogram extractor scaffold <target> [--track <track>] [--package <name>] [--id <manifest-id>]"] };
  }
  if (fs.existsSync(absoluteTarget) && fs.readdirSync(absoluteTarget).length > 0) {
    return { ok: false, target: absoluteTarget, packageName: null, manifestId: null, track: null, files: [], nextCommands: [], errors: [`Extractor scaffold target '${absoluteTarget}' already exists and is not empty.`] };
  }

  const track = options.track || DEFAULT_TRACK;
  if (!EXTRACTOR_TRACKS.includes(track)) {
    return { ok: false, target: absoluteTarget, packageName: null, manifestId: null, track, files: [], nextCommands: [], errors: [`Extractor track '${track}' is not supported. Expected one of: ${EXTRACTOR_TRACKS.join(", ")}.`] };
  }

  const packageName = options.packageName || defaultPackageName(absoluteTarget);
  if (!isValidPackageName(packageName)) {
    return { ok: false, target: absoluteTarget, packageName, manifestId: null, track, files: [], nextCommands: [], errors: [`Extractor package name '${packageName}' is invalid. Use a lowercase npm package name such as @scope/topogram-extractor-example.`] };
  }
  const manifestId = options.manifestId || packageName;
  const extractor = extractorId(packageName, track);
  const defaults = trackDefaults(track);
  const manifest = {
    id: manifestId,
    version: "1",
    tracks: [track],
    source: "package",
    package: packageName,
    compatibleCliRange: `^${currentCliVersion()}`,
    stack: defaults.stack,
    capabilities: defaults.capabilities,
    candidateKinds: defaults.candidateKinds,
    evidenceTypes: ["runtime_source"],
    extractors: [extractor]
  };
  const packageJson = {
    name: packageName,
    version: "0.1.0",
    private: true,
    description: "Topogram extractor pack scaffold.",
    main: "index.cjs",
    files: [
      "index.cjs",
      "topogram-extractor.json",
      "AGENTS.md",
      "README.md",
      "scripts",
      "fixtures"
    ],
    scripts: {
      check: "node ./scripts/check-extractor.mjs"
    },
    devDependencies: {
      "@topogram/cli": `^${currentCliVersion()}`
    }
  };
  const files = {
    [path.join(absoluteTarget, "package.json")]: `${stableStringify(packageJson)}\n`,
    [path.join(absoluteTarget, "topogram-extractor.json")]: `${stableStringify(manifest)}\n`,
    [path.join(absoluteTarget, "index.cjs")]: adapterSource(track, extractor),
    [path.join(absoluteTarget, "scripts", "check-extractor.mjs")]: checkScriptSource(packageName, track),
    [path.join(absoluteTarget, "AGENTS.md")]: `# Extractor Pack Agent Guide

This repository is a Topogram extractor pack for the \`${track}\` track.

## Rules

- Extractors are read-only. Do not mutate source app files.
- Do not write canonical \`topo/**\`, \`topogram.project.json\`, patches, adoption plans, or generated app output.
- Do not install packages or perform network access during detection or extraction.
- Return review-only \`findings\`, \`candidates\`, and \`diagnostics\`; Topogram core owns persistence, reconcile, adoption, and canonical writes.
- Keep candidate evidence project-relative and portable.
- Use scalar \`stacks: ["framework"]\` and \`frameworks: ["tool"]\` metadata buckets.
- Run \`npm run check\` before committing. It must prove extractor check, real fixture extraction, extract plan, query extract-plan, adopt list, and unchanged fixture source.

## Local Engine Testing

\`\`\`bash
TOPOGRAM_CLI=/absolute/path/to/topogram/engine/src/cli.js npm run check
\`\`\`

SDLC is recommended for shared or published extractor packs. If adopted, keep extractor rules and tasks in the package repo's \`topo/\` workspace so agents can query them.
`,
    [path.join(absoluteTarget, "README.md")]: `# ${packageName}

This is a Topogram extractor pack scaffold for the \`${track}\` track.

## Author Loop

\`\`\`bash
npm install
npm run check
\`\`\`

\`npm run check\` uses \`TOPOGRAM_CLI\`, then \`TOPOGRAM_BIN\`, then \`topogram\`.
Use \`TOPOGRAM_CLI=/path/to/topogram/engine/src/cli.js npm run check\` while
developing against a local Topogram checkout.

\`npm run check\` runs:

- \`topogram extractor check .\`
- \`topogram extract ./fixtures/basic-source --out <tmp> --from ${track} --extractor .\`
- \`topogram extract plan <tmp>\`
- \`topogram query extract-plan <tmp>/topo\`
- \`topogram adopt --list <tmp>\`

Replace the scaffold adapter in \`index.cjs\` with precise, read-only source evidence.
Extractor packages must not mutate source files, write canonical \`topo/**\`, install
packages, perform network access, or define adoption semantics.

Shared or published extractor packs should adopt SDLC so rules, tasks, and proof
history are queryable by agents. Private one-off extractors may stay lightweight,
but they should still follow the generated \`AGENTS.md\` rules.

Candidate output is validated by track. Return only review candidate buckets for
the declared track, give each candidate a stable identity, keep file evidence
project-relative, and never return files, patches, adoption plans, or write
instructions. \`stacks\` and \`frameworks\` are string metadata buckets; API
parameter shorthands such as \`path_params: ["id"]\` are normalized by Topogram.
`
  };
  for (const [relative, contents] of Object.entries(defaults.fixtureFiles)) {
    files[path.join(absoluteTarget, "fixtures", "basic-source", relative)] = contents;
  }

  const written = writeFiles(files);
  return {
    ok: true,
    target: absoluteTarget,
    packageName,
    manifestId,
    track,
    files: written.map((filePath) => path.relative(absoluteTarget, filePath).replace(/\\/g, "/")),
    nextCommands: [
      `cd ${absoluteTarget}`,
      "npm install",
      "npm run check",
      "topogram extractor check ."
    ],
    errors: []
  };
}
