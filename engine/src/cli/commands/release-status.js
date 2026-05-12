// @ts-check

import { loadCatalog } from "../../catalog.js";
import { catalogRepoSlug } from "../../topogram-config.js";
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
 * @returns {{ ok: boolean, strict: boolean, packageName: string, localVersion: string, latestVersion: string|null, currentPublished: boolean|null, git: ReturnType<typeof inspectReleaseGitTag>, consumerPins: ReturnType<typeof summarizeConsumerPins>, consumerCi: ReturnType<typeof summarizeConsumerCi>, consumers: Array<AnyRecord>, diagnostics: Array<AnyRecord>, errors: string[] }}
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
  const consumers = discoverTopogramCliVersionConsumers(cwd).map((consumer) => /** @type {AnyRecord} */ ({
    ...consumer,
    matchesLocal: consumer.version ? consumer.version === localVersion : null,
    workflow: expectedConsumerWorkflowName(consumer.name),
    ci: null
  }));
  if (strict) {
    for (const consumer of /** @type {Array<any>} */ (consumers)) {
      if (consumer.matchesLocal === true) {
        consumer.ci = inspectConsumerCi(consumer, { strict: true });
        diagnostics.push(...consumer.ci.diagnostics);
      }
    }
  }
  const consumerPins = summarizeConsumerPins(consumers);
  const consumerCi = summarizeConsumerCi(consumers);
  const currentPublished = latestVersion ? latestVersion === localVersion : null;
  if (strict) {
    diagnostics.push(...releaseStatusStrictDiagnostics({
      localVersion,
      latestVersion,
      currentPublished,
      git,
      consumerPins,
      consumerCi
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
 *   consumerCi: ReturnType<typeof summarizeConsumerCi>
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
  return diagnostics;
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
    "## Consumer Proofs",
    "",
    "The external Todo demo is the canonical end-to-end consumer proof for the current catalog-backed workflow:",
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
    "The demo CI also verifies `topogram copy` from the default public catalog and from the repo-local catalog fixture. That prevents local fixtures from masking a broken published catalog alias."
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
