// @ts-check

import fs from "node:fs";
import path from "node:path";

import { loadCatalog } from "../../catalog.js";
import {
  catalogRepoSlug,
  releaseProofMinimumVersion,
  releaseProofConsumerRepos,
  releaseProofConsumerWorkflowJobs,
  releaseProofConsumerWorkflowName
} from "../../topogram-config.js";
import {
  CLI_PACKAGE_NAME,
  latestTopogramCliVersion,
  readInstalledCliPackageVersion
} from "./package.js";
import {
  discoverTopogramCliVersionConsumers,
  expectedConsumerWorkflowName,
  inspectConsumerCi,
  inspectReleaseGitTag,
  messageFromError,
  summarizeConsumerCi,
  summarizeConsumerPins
} from "./release-shared.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {{ cwd?: string, strict?: boolean }} [options]
 * @returns {{ ok: boolean, strict: boolean, packageName: string, localVersion: string, latestVersion: string|null, currentPublished: boolean|null, git: ReturnType<typeof inspectReleaseGitTag>, consumerPins: ReturnType<typeof summarizeConsumerPins>, consumerCi: ReturnType<typeof summarizeConsumerCi>, consumers: Array<AnyRecord>, proofMinimumVersion: string|null, proofConsumerPins: ReturnType<typeof summarizeConsumerPins>, proofConsumerFreshness: ReturnType<typeof summarizeProofConsumerFreshness>, proofConsumerCi: ReturnType<typeof summarizeConsumerCi>, proofConsumerScripts: ReturnType<typeof summarizeProofConsumerScripts>, proofConsumers: Array<AnyRecord>, diagnostics: Array<AnyRecord>, errors: string[] }}
 */
export function buildReleaseStatusPayload(options = {}) {
  const cwd = options.cwd || process.cwd();
  const strict = Boolean(options.strict);
  const localVersion = readInstalledCliPackageVersion();
  /** @type {Array<AnyRecord>} */
  const diagnostics = [];
  let latestVersion = null;
  try {
    latestVersion = latestTopogramCliVersion(cwd);
  } catch (error) {
    diagnostics.push({
      code: "release_latest_unavailable",
      severity: "warning",
      message: messageFromError(error),
      path: CLI_PACKAGE_NAME,
      suggestedFix: "Check npmjs access and rerun `topogram release status`."
    });
  }
  const git = inspectReleaseGitTag(localVersion, cwd);
  diagnostics.push(...git.diagnostics);
  const proofMinimumVersion = releaseProofMinimumVersion(cwd);
  const consumers = discoverTopogramCliVersionConsumers(cwd).map((consumer) => /** @type {AnyRecord} */ ({
    ...consumer,
    matchesLocal: consumer.version ? consumer.version === localVersion : null,
    workflow: expectedConsumerWorkflowName(consumer.name),
    ci: null
  }));
  const proofConsumers = discoverTopogramCliVersionConsumers(cwd, releaseProofConsumerRepos(cwd)).map((discovered) => {
    const consumer = normalizeProofConsumerPin(discovered);
    const requiredScripts = ["proof:audit", "verify"];
    return /** @type {AnyRecord} */ ({
      ...consumer,
      matchesLocal: consumer.version ? consumer.version === localVersion : null,
      baselineVersion: proofMinimumVersion,
      meetsBaseline: proofMinimumVersion && consumer.version
        ? compareVersions(consumer.version, proofMinimumVersion) >= 0
        : consumer.version ? true : null,
      refreshRecommended: consumer.version ? consumer.version !== localVersion : null,
      workflow: releaseProofConsumerWorkflowName(consumer.name),
      expectedJobs: releaseProofConsumerWorkflowJobs(consumer.name),
      requiredScripts,
      scripts: inspectRequiredPackageScripts(consumer.root, requiredScripts),
      ci: null
    });
  });
  if (strict) {
    for (const consumer of /** @type {Array<any>} */ (consumers)) {
      if (consumer.matchesLocal === true) {
        consumer.ci = inspectConsumerCi(consumer, { strict: true });
        diagnostics.push(...consumer.ci.diagnostics);
      }
    }
    for (const consumer of /** @type {Array<any>} */ (proofConsumers)) {
      if (consumer.meetsBaseline === true) {
        consumer.ci = inspectConsumerCi(consumer, { strict: true });
        diagnostics.push(...consumer.ci.diagnostics);
      }
    }
  }
  const consumerPins = summarizeConsumerPins(consumers);
  const consumerCi = summarizeConsumerCi(consumers);
  const proofConsumerPins = summarizeConsumerPins(proofConsumers);
  const proofConsumerFreshness = summarizeProofConsumerFreshness(proofConsumers, proofMinimumVersion, localVersion);
  const proofConsumerCi = summarizeConsumerCi(proofConsumers);
  const proofConsumerScripts = summarizeProofConsumerScripts(proofConsumers);
  const currentPublished = latestVersion ? latestVersion === localVersion : null;
  if (strict) {
    diagnostics.push(...releaseStatusStrictDiagnostics({
      localVersion,
      latestVersion,
      currentPublished,
      git,
      consumerPins,
      consumerCi,
      proofConsumerFreshness,
      proofConsumerPins,
      proofConsumerCi,
      proofConsumerScripts
    }));
  }
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    strict,
    packageName: CLI_PACKAGE_NAME,
    localVersion,
    latestVersion,
    currentPublished,
    git,
    consumerPins,
    consumerCi,
    consumers,
    proofMinimumVersion,
    proofConsumerPins,
    proofConsumerFreshness,
    proofConsumerCi,
    proofConsumerScripts,
    proofConsumers,
    diagnostics,
    errors
  };
}

/**
 * @param {{
 *   localVersion: string,
 *   latestVersion: string|null,
 *   currentPublished: boolean|null,
 *   git: ReturnType<typeof inspectReleaseGitTag>,
 *   consumerPins: ReturnType<typeof summarizeConsumerPins>,
 *   consumerCi: ReturnType<typeof summarizeConsumerCi>,
 *   proofConsumerFreshness: ReturnType<typeof summarizeProofConsumerFreshness>,
 *   proofConsumerPins: ReturnType<typeof summarizeConsumerPins>,
 *   proofConsumerCi: ReturnType<typeof summarizeConsumerCi>,
 *   proofConsumerScripts: ReturnType<typeof summarizeProofConsumerScripts>
 * }} release
 * @returns {Array<{ code: string, severity: "error", message: string, path: string, suggestedFix: string }>}
 */
function releaseStatusStrictDiagnostics(release) {
  /** @type {Array<{ code: string, severity: "error", message: string, path: string, suggestedFix: string }>} */
  const diagnostics = [];
  if (release.currentPublished !== true) {
    diagnostics.push({
      code: "release_latest_not_current",
      severity: "error",
      message: release.latestVersion
        ? `${CLI_PACKAGE_NAME}@${release.localVersion} is not the latest published version (${release.latestVersion}).`
        : `Latest published ${CLI_PACKAGE_NAME} version could not be verified.`,
      path: CLI_PACKAGE_NAME,
      suggestedFix: "Publish the current CLI package version or fix npm package registry auth, then rerun `topogram release status --strict`."
    });
  }
  if (release.git.local !== true && release.git.remote !== true) {
    diagnostics.push({
      code: "release_local_tag_missing",
      severity: "error",
      message: `Release tag ${release.git.tag} is missing locally.`,
      path: release.git.tag,
      suggestedFix: `Fetch, create, or push ${release.git.tag} before treating this release as complete.`
    });
  }
  if (release.git.remote !== true) {
    diagnostics.push({
      code: "release_remote_tag_missing",
      severity: "error",
      message: `Release tag ${release.git.tag} is missing on origin.`,
      path: release.git.tag,
      suggestedFix: `Push or create the remote ${release.git.tag} tag before treating this release as complete.`
    });
  }
  if (release.consumerPins.allKnownPinned !== true) {
    diagnostics.push({
      code: "release_consumer_pins_not_current",
      severity: "error",
      message: `First-party consumers are not all pinned to ${CLI_PACKAGE_NAME}@${release.localVersion}.`,
      path: "topogram-cli.version",
      suggestedFix: "Roll first-party consumer repositories to the current CLI version before treating this release as complete."
    });
  }
  if (release.consumerCi.allCheckedAndPassing !== true) {
    diagnostics.push({
      code: "release_consumer_ci_not_current",
      severity: "error",
      message: "First-party consumer verification workflows are not all passing on the checked-out consumer commits.",
      path: "GitHub Actions",
      suggestedFix: "Wait for or fix the consumer verification workflows, then rerun `topogram release status --strict`."
    });
  }
  if (release.proofConsumerPins.known > 0 && release.proofConsumerFreshness.allMeetBaseline !== true) {
    diagnostics.push({
      code: "release_proof_consumer_baseline_not_met",
      severity: "error",
      message: `Public proof consumers do not all meet the configured proof baseline ${release.proofConsumerFreshness.minimumVersion || "none"}.`,
      path: "package.json",
      suggestedFix: "Refresh only the stale proof repositories that are below the configured baseline, or intentionally update the proof baseline after reviewing proof coverage."
    });
  }
  if (release.proofConsumerPins.known > 0 && release.proofConsumerScripts.allPresent !== true) {
    diagnostics.push({
      code: "release_proof_consumer_scripts_missing",
      severity: "error",
      message: "Public proof consumers are missing required proof audit or verification scripts.",
      path: "package.json",
      suggestedFix: "Add proof:audit and verify scripts to proof repositories, then rerun `topogram release status --strict`."
    });
  }
  if (release.proofConsumerPins.known > 0 && release.proofConsumerCi.allCheckedAndPassing !== true) {
    diagnostics.push({
      code: "release_proof_consumer_ci_not_current",
      severity: "error",
      message: "Public proof consumer verification workflows are not all passing on the checked-out proof commits.",
      path: "GitHub Actions",
      suggestedFix: "Wait for or fix the proof repository workflows, then rerun `topogram release status --strict`."
    });
  }
  return diagnostics;
}

/**
 * @param {string|null|undefined} root
 * @param {string[]} requiredScripts
 * @returns {{ checked: boolean, packageJson: string|null, required: string[], present: string[], missing: string[] }}
 */
function inspectRequiredPackageScripts(root, requiredScripts) {
  if (!root) {
    return {
      checked: false,
      packageJson: null,
      required: [...requiredScripts],
      present: [],
      missing: [...requiredScripts]
    };
  }
  const packageJson = path.join(root, "package.json");
  if (!fs.existsSync(packageJson)) {
    return {
      checked: false,
      packageJson,
      required: [...requiredScripts],
      present: [],
      missing: [...requiredScripts]
    };
  }
  let scripts = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8"));
    scripts = parsed && typeof parsed === "object" && parsed.scripts && typeof parsed.scripts === "object"
      ? parsed.scripts
      : {};
  } catch {
    scripts = {};
  }
  const present = requiredScripts.filter((script) => Object.prototype.hasOwnProperty.call(scripts, script));
  const missing = requiredScripts.filter((script) => !present.includes(script));
  return {
    checked: true,
    packageJson,
    required: [...requiredScripts],
    present,
    missing
  };
}

/**
 * Proof repositories are product walkthrough repos, not package rollout repos,
 * so they may pin the CLI only through package.json instead of topogram-cli.version.
 *
 * @param {{ name: string, root: string|null, path: string, version: string|null, found: boolean }} consumer
 * @returns {{ name: string, root: string|null, path: string, version: string|null, found: boolean }}
 */
function normalizeProofConsumerPin(consumer) {
  if (consumer.version || !consumer.root) {
    return consumer;
  }
  const packageJson = path.join(consumer.root, "package.json");
  if (!fs.existsSync(packageJson)) {
    return consumer;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8"));
    const version = parsed?.devDependencies?.[CLI_PACKAGE_NAME] || parsed?.dependencies?.[CLI_PACKAGE_NAME] || null;
    if (version) {
      return {
        ...consumer,
        path: packageJson,
        version: String(version).trim() || null,
        found: true
      };
    }
  } catch {
    return consumer;
  }
  return consumer;
}

/**
 * @param {string|null|undefined} left
 * @param {string|null|undefined} right
 * @returns {number}
 */
function compareVersions(left, right) {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }
  return 0;
}

/**
 * @param {string|null|undefined} value
 * @returns {number[]}
 */
function parseVersionParts(value) {
  return String(value || "")
    .replace(/^[^\d]*/, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => Number.isFinite(part) ? part : 0);
}

/**
 * @param {Array<any>} consumers
 * @param {string|null} minimumVersion
 * @param {string} currentVersion
 * @returns {{ known: number, pinned: number, current: number, staleButAccepted: number, belowBaseline: number, missing: number, minimumVersion: string|null, currentVersion: string, allMeetBaseline: boolean, refreshRecommendedNames: string[], belowBaselineNames: string[], missingNames: string[] }}
 */
function summarizeProofConsumerFreshness(consumers, minimumVersion, currentVersion) {
  const pinnedConsumers = consumers.filter((consumer) => consumer.found && consumer.version);
  const missingNames = consumers.filter((consumer) => !consumer.found || !consumer.version).map((consumer) => consumer.name);
  const belowBaselineNames = consumers
    .filter((consumer) => consumer.version && consumer.meetsBaseline === false)
    .map((consumer) => consumer.name);
  const currentNames = consumers
    .filter((consumer) => consumer.version && consumer.version === currentVersion)
    .map((consumer) => consumer.name);
  const refreshRecommendedNames = consumers
    .filter((consumer) => consumer.refreshRecommended === true)
    .map((consumer) => consumer.name);
  return {
    known: consumers.length,
    pinned: pinnedConsumers.length,
    current: currentNames.length,
    staleButAccepted: refreshRecommendedNames.filter((name) => !belowBaselineNames.includes(name)).length,
    belowBaseline: belowBaselineNames.length,
    missing: missingNames.length,
    minimumVersion,
    currentVersion,
    allMeetBaseline: consumers.length > 0 && missingNames.length === 0 && belowBaselineNames.length === 0,
    refreshRecommendedNames,
    belowBaselineNames,
    missingNames
  };
}

/**
 * @param {Array<any>} consumers
 * @returns {{ checked: number, present: number, missing: number, allPresent: boolean, missingNames: string[] }}
 */
function summarizeProofConsumerScripts(consumers) {
  const checked = consumers.filter((consumer) => consumer.scripts?.checked);
  const missingNames = consumers
    .filter((consumer) => !consumer.scripts?.checked || (consumer.scripts?.missing || []).length > 0)
    .map((consumer) => consumer.name);
  return {
    checked: checked.length,
    present: consumers.length - missingNames.length,
    missing: missingNames.length,
    allPresent: consumers.length > 0 && missingNames.length === 0,
    missingNames
  };
}

/**
 * @param {ReturnType<typeof buildReleaseStatusPayload>} payload
 * @returns {void}
 */
export function printReleaseStatus(payload) {
  console.log(payload.ok ? "Topogram release status passed." : "Topogram release status found issues.");
  if (payload.strict) {
    console.log("Strict: enabled");
  }
  console.log(`Package: ${payload.packageName}`);
  console.log(`Local version: ${payload.localVersion}`);
  console.log(`Latest published: ${payload.latestVersion || "unknown"}${payload.currentPublished === true ? " (current)" : payload.currentPublished === false ? " (differs)" : ""}`);
  console.log(`Git tag: ${payload.git.tag} local=${labelBoolean(payload.git.local)} remote=${labelBoolean(payload.git.remote)}`);
  console.log(
    `Consumer pins: ${payload.consumerPins.pinned}/${payload.consumerPins.known} pinned, ` +
    `${payload.consumerPins.matching} matching, ${payload.consumerPins.differing} differing, ${payload.consumerPins.missing} missing`
  );
  if (payload.strict) {
    console.log(
      `Consumer CI: ${payload.consumerCi.passing}/${payload.consumerCi.checked} passing, ` +
      `${payload.consumerCi.failing} failing, ${payload.consumerCi.unavailable} unavailable, ${payload.consumerCi.skipped} skipped`
    );
  }
  console.log(
    `Proof consumer baseline: ${payload.proofConsumerFreshness.pinned}/${payload.proofConsumerFreshness.known} pinned, ` +
    `${payload.proofConsumerFreshness.current} current, ${payload.proofConsumerFreshness.staleButAccepted} baseline-accepted, ` +
    `${payload.proofConsumerFreshness.belowBaseline} below baseline, ${payload.proofConsumerFreshness.missing} missing` +
    `${payload.proofMinimumVersion ? ` (minimum ${payload.proofMinimumVersion})` : ""}`
  );
  console.log(
    `Proof consumer scripts: ${payload.proofConsumerScripts.present}/${payload.proofConsumerScripts.present + payload.proofConsumerScripts.missing} complete`
  );
  if (payload.strict) {
    console.log(
      `Proof consumer CI: ${payload.proofConsumerCi.passing}/${payload.proofConsumerCi.checked} passing, ` +
      `${payload.proofConsumerCi.failing} failing, ${payload.proofConsumerCi.unavailable} unavailable, ${payload.proofConsumerCi.skipped} skipped`
    );
  }
  for (const consumer of payload.consumers) {
    const status = consumer.matchesLocal === true
      ? "matches"
      : consumer.matchesLocal === false
        ? "differs"
        : "missing";
    const ciStatus = consumer.ci?.run
      ? `; ${consumer.ci.run.workflowName || consumer.workflow}: ${consumer.ci.run.status || "unknown"}/${consumer.ci.run.conclusion || "unknown"}`
      : consumer.ci?.checked
        ? `; ${consumer.workflow || "workflow"} unavailable`
        : "";
    console.log(`- ${consumer.name}: ${consumer.version || "missing"} (${status})${ciStatus}`);
    if (consumer.ci?.run?.url) {
      console.log(`  CI: ${consumer.ci.run.url}`);
    }
  }
  for (const consumer of payload.proofConsumers) {
    const status = consumer.matchesLocal === true
      ? "current"
      : consumer.meetsBaseline === true
        ? "baseline"
        : consumer.meetsBaseline === false
          ? "below-baseline"
          : "missing";
    const ciStatus = consumer.ci?.run
      ? `; ${consumer.ci.run.workflowName || consumer.workflow}: ${consumer.ci.run.status || "unknown"}/${consumer.ci.run.conclusion || "unknown"}`
      : consumer.ci?.checked
        ? `; ${consumer.workflow || "workflow"} unavailable`
        : "";
    const missingScripts = consumer.scripts?.missing?.length
      ? `; missing scripts: ${consumer.scripts.missing.join(", ")}`
      : "";
    console.log(`- proof ${consumer.name}: ${consumer.version || "missing"} (${status})${missingScripts}${ciStatus}`);
    if (consumer.ci?.run?.url) {
      console.log(`  CI: ${consumer.ci.run.url}`);
    }
  }
  if (payload.diagnostics.length > 0) {
    console.log("Diagnostics:");
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning"
        ? "Warning"
        : diagnostic.severity === "info"
          ? "Note"
          : "Error";
      console.log(`- ${label}: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        console.log(`  Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
}

/**
 * @param {ReturnType<typeof buildReleaseStatusPayload>} payload
 * @returns {string}
 */
export function renderReleaseStatusMarkdown(payload) {
  const matrix = buildReleaseMatrixCatalogPayload();
  const catalogConsumer = payload.consumers.find((consumer) => consumer.name === "topograms");
  const demoConsumer = payload.consumers.find((consumer) => consumer.name === "topogram-demo-todo");
  const catalogSlug = catalogRepoSlug();
  const lines = [
    "# Known-Good Release Matrix",
    "",
    "This matrix is generated by `topogram release status --strict --write-report`.",
    `Date checked: ${new Date().toISOString().slice(0, 10)}.`,
    "Treat it as a dated release audit, not a floating compatibility promise.",
    "",
    "## Summary",
    "",
    `- Package: \`${payload.packageName}@${payload.localVersion}\``,
    `- Latest published: \`${payload.latestVersion || "unknown"}\`${payload.currentPublished === true ? " (current)" : payload.currentPublished === false ? " (differs)" : ""}`,
    `- Release tag: \`${payload.git.tag}\` (local=${labelBoolean(payload.git.local)}, remote=${labelBoolean(payload.git.remote)})`,
    `- Consumer pins: ${payload.consumerPins.matching}/${payload.consumerPins.known} matching`,
    `- Consumer CI: ${payload.consumerCi.passing}/${payload.consumerCi.checked} passing`,
    `- Proof consumer baseline: ${payload.proofConsumerFreshness.pinned}/${payload.proofConsumerFreshness.known} pinned, ${payload.proofConsumerFreshness.current} current, ${payload.proofConsumerFreshness.staleButAccepted} baseline-accepted, ${payload.proofConsumerFreshness.belowBaseline} below baseline${payload.proofMinimumVersion ? ` (minimum ${payload.proofMinimumVersion})` : ""}`,
    `- Proof consumer CI: ${payload.proofConsumerCi.passing}/${payload.proofConsumerCi.checked} passing`,
    `- Strict status: ${payload.ok ? "passed" : "failed"}`,
    "",
    "## Core",
    "",
    "| Package or Repo | Version or Commit | Verification |",
    "| --- | --- | --- |",
    `| \`${payload.packageName}\` | \`${payload.localVersion}\` | Publish CLI Package, strict release status, fresh npmjs smoke, and installed CLI smoke passed |`,
    `| \`${catalogSlug}\` catalog | \`${releaseMatrixConsumerCommit(catalogConsumer)}\` | ${releaseMatrixConsumerVerification(catalogConsumer, "Catalog Verification", payload.localVersion)} |`,
    `| \`topogram-demo-todo\` | \`${releaseMatrixConsumerCommit(demoConsumer)}\` | ${releaseMatrixConsumerVerification(demoConsumer, "Demo Verification", payload.localVersion)} |`,
    "",
    "## Catalog Entries",
    "",
    "| Catalog ID | Kind | Package | Version | Stack |",
    "| --- | --- | --- | --- | --- |"
  ];
  if (matrix.entries.length > 0) {
    for (const entry of matrix.entries) {
      lines.push(`| \`${entry.id}\` | ${entry.kind} | \`${entry.package}\` | \`${entry.defaultVersion}\` | ${escapeMarkdownTableCell(entry.stack || "not declared")} |`);
    }
  } else {
    lines.push("| unavailable | unavailable | unavailable | unavailable | Catalog could not be loaded for this report |");
  }
  lines.push(
    "",
    "## Generator Packages",
    "",
    "| Generator Package | Surface | Catalog usage |",
    "| --- | --- | --- |"
  );
  if (matrix.generators.length > 0) {
    for (const generator of matrix.generators) {
      lines.push(`| \`${generator.package}\` | ${escapeMarkdownTableCell(generator.surface)} | ${escapeMarkdownTableCell(generator.catalogIds.join(", "))} |`);
    }
  } else {
    lines.push("| unavailable | unavailable | Catalog generator metadata could not be loaded for this report |");
  }
  lines.push(
    "",
    "## Consumers",
    "",
    "| Repo | Pin | Workflow | Status | Run |",
    "| --- | --- | --- | --- | --- |"
  );
  for (const consumer of payload.consumers) {
    const workflow = consumer.workflow || consumer.ci?.expectedWorkflow || "";
    const run = consumer.ci?.run;
    const status = run ? `${run.status || "unknown"}/${run.conclusion || "unknown"}` : consumer.ci?.checked ? "unavailable" : "not checked";
    const url = run?.url ? `[${run.databaseId || "run"}](${run.url})` : "";
    lines.push(`| \`${consumer.name}\` | \`${consumer.version || "missing"}\` | ${escapeMarkdownTableCell(workflow)} | ${escapeMarkdownTableCell(status)} | ${url} |`);
  }
  lines.push(
    "",
    "## Proof Consumers",
    "",
    "| Repo | Pin | Baseline | Freshness | Required scripts | Workflow | Status | Run |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  );
  for (const consumer of payload.proofConsumers) {
    const workflow = consumer.workflow || consumer.ci?.expectedWorkflow || "";
    const run = consumer.ci?.run;
    const status = run ? `${run.status || "unknown"}/${run.conclusion || "unknown"}` : consumer.ci?.checked ? "unavailable" : "not checked";
    const url = run?.url ? `[${run.databaseId || "run"}](${run.url})` : "";
    const freshness = consumer.matchesLocal === true
      ? "current"
      : consumer.meetsBaseline === true
        ? "baseline-accepted"
        : consumer.meetsBaseline === false
          ? "below-baseline"
          : "missing";
    const missingScripts = consumer.scripts?.missing?.length
      ? `missing ${consumer.scripts.missing.join(", ")}`
      : "proof:audit, verify";
    lines.push(`| \`${consumer.name}\` | \`${consumer.version || "missing"}\` | \`${payload.proofMinimumVersion || "none"}\` | ${escapeMarkdownTableCell(freshness)} | ${escapeMarkdownTableCell(missingScripts)} | ${escapeMarkdownTableCell(workflow)} | ${escapeMarkdownTableCell(status)} | ${url} |`);
  }
  lines.push(
    "",
    "## Consumer Proofs",
    "",
    "The external Todo demo remains the canonical end-to-end consumer proof for the current catalog-backed workflow:",
    "",
    "```bash",
    "topogram copy todo ./todo-demo",
    "cd ./todo-demo",
    "npm install",
    "npm run check",
    "npm run generate",
    "npm run app:compile",
    "npm run verify",
    "npm run app:runtime",
    "```",
    "",
    "The demo CI also verifies `topogram copy` from the default public catalog and from the repo-local catalog fixture. That prevents local fixtures from masking a broken published catalog alias.",
    "",
    "Proof consumer repositories are tracked separately from package rollout consumers. They are tutorial-style public product proofs, so strict release status checks their baseline CLI version, proof audit/verify scripts, and Proof Verification CI without adding them to `release roll-consumers` or requiring every patch release to refresh proof tags."
  );
  const reportDiagnostics = [...matrix.diagnostics];
  if (reportDiagnostics.length > 0) {
    lines.push("", "## Report Diagnostics", "");
    for (const diagnostic of reportDiagnostics) {
      lines.push(`- **${diagnostic.severity || "warning"}** \`${diagnostic.code || "release_report_catalog_unavailable"}\`: ${diagnostic.message}`);
    }
  }
  if (payload.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", "");
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning"
        ? "Warning"
        : diagnostic.severity === "info"
          ? "Note"
          : "Error";
      lines.push(`- **${label}** \`${diagnostic.code}\`: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        lines.push(`  Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @returns {{ entries: any[], generators: Array<{ package: string, surface: string, catalogIds: string[] }>, diagnostics: Array<AnyRecord> }}
 */
function buildReleaseMatrixCatalogPayload() {
  try {
    const loaded = loadCatalog(null);
    const entries = [...loaded.catalog.entries].sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "template" ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    });
    const generatorMap = new Map();
    for (const entry of entries) {
      for (const packageName of Array.isArray(entry.generators) ? entry.generators : []) {
        if (!generatorMap.has(packageName)) {
          generatorMap.set(packageName, {
            package: packageName,
            surface: releaseMatrixGeneratorSurface(packageName),
            catalogIds: []
          });
        }
        generatorMap.get(packageName).catalogIds.push(entry.id);
      }
    }
    const generators = [...generatorMap.values()].sort((left, right) => left.package.localeCompare(right.package));
    return {
      entries,
      generators,
      diagnostics: loaded.diagnostics || []
    };
  } catch (error) {
    return {
      entries: [],
      generators: [],
      diagnostics: [{
        code: "release_report_catalog_unavailable",
        severity: "warning",
        message: messageFromError(error)
      }]
    };
  }
}

/**
 * @param {string} packageName
 * @returns {string}
 */
function releaseMatrixGeneratorSurface(packageName) {
  if (packageName.includes("-web")) return "web";
  if (packageName.includes("-api")) return "api";
  if (packageName.includes("-db")) return "database";
  if (packageName.includes("-native")) return "native";
  return "not declared";
}

/**
 * @param {any} consumer
 * @returns {string}
 */
function releaseMatrixConsumerCommit(consumer) {
  return shortSha(consumer?.ci?.headSha || consumer?.ci?.run?.headSha || null) || "unknown";
}

/**
 * @param {any} consumer
 * @param {string} workflowName
 * @param {string} version
 * @returns {string}
 */
function releaseMatrixConsumerVerification(consumer, workflowName, version) {
  const status = consumer?.ci?.run
    ? `${consumer.ci.run.status || "unknown"}/${consumer.ci.run.conclusion || "unknown"}`
    : "not checked";
  return `${workflowName}: ${status}; pinned ${CLI_PACKAGE_NAME}@${version}`;
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function shortSha(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 7) : null;
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function escapeMarkdownTableCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

/**
 * @param {boolean|null} value
 * @returns {string}
 */
function labelBoolean(value) {
  return value === true ? "yes" : value === false ? "no" : "unknown";
}
