// @ts-check

import path from "node:path";

import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors } from "../../validator.js";
import { resolveTopoRoot } from "../../workspace-paths.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || null : null;
}

/**
 * @param {string[]} args
 * @returns {boolean}
 */
function includeHistory(args) {
  return args.includes("--history") || args.includes("--include-history");
}

/**
 * @param {string} sdlcRoot
 * @returns {AnyRecord|null}
 */
function resolveSdlcWorkspace(sdlcRoot) {
  const ast = parsePath(sdlcRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    console.error(formatValidationErrors(resolved.validation));
    return null;
  }
  return resolved;
}

/**
 * Runs `topogram sdlc ...` commands and the legacy top-level `topogram release`
 * command.
 *
 * @param {{
 *   commandArgs: AnyRecord,
 *   args: string[],
 *   inputPath: string|null|undefined
 * }} context
 * @returns {Promise<number>}
 */
export async function runSdlcCommand(context) {
  const { commandArgs, args } = context;
  const sdlcRoot = resolveTopoRoot(context.inputPath || ".");
  const actor = flagValue(args, "--actor");
  const note = flagValue(args, "--note");
  const status = flagValue(args, "--status");
  const before = flagValue(args, "--before");
  const appVersion = flagValue(args, "--app-version");
  const sinceTag = flagValue(args, "--since-tag");
  const dryRun = args.includes("--dry-run");
  const strict = args.includes("--strict");

  if (commandArgs.sdlcCommand === "transition") {
    const { transitionStatement } = await import("../../sdlc/transition.js");
    const result = transitionStatement(sdlcRoot, commandArgs.sdlcId, commandArgs.sdlcTargetStatus, {
      actor,
      note,
      dryRun
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "check") {
    const { checkWorkspace } = await import("../../sdlc/check.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const result = checkWorkspace(sdlcRoot, resolved);
    console.log(stableStringify(result));
    return strict && (!result.ok || result.warnings.length > 0) ? 1 : 0;
  }

  if (commandArgs.sdlcCommand === "explain") {
    const { explain } = await import("../../sdlc/explain.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const result = explain(sdlcRoot, resolved, commandArgs.sdlcId, {
      includeHistory: includeHistory(args)
    });
    if (args.includes("--brief") && result.ok) {
      console.log(stableStringify({
        id: result.id,
        status: result.status,
        next_action: result.next_action
      }));
    } else {
      console.log(stableStringify(result));
    }
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "archive") {
    const { archiveBatch, archiveEligibleStatements } = await import("../../archive/archive.js");
    const resolved = resolveSdlcWorkspace(sdlcRoot);
    if (!resolved) {
      return 1;
    }
    const ids = archiveEligibleStatements(resolved, {
      before,
      statuses: status ? status.split(",") : null
    });
    const result = archiveBatch(sdlcRoot, ids, { dryRun, by: actor, reason: note });
    console.log(stableStringify({ candidates: ids, ...result }));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "unarchive") {
    const { unarchive } = await import("../../archive/unarchive.js");
    const result = unarchive(sdlcRoot, commandArgs.sdlcId, {});
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "compact") {
    const { compact } = await import("../../archive/compact.js");
    const result = compact(path.resolve(commandArgs.sdlcArchiveFile));
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "new") {
    const { scaffoldNew } = await import("../../sdlc/scaffold.js");
    const result = scaffoldNew(sdlcRoot, commandArgs.sdlcNewKind, commandArgs.sdlcNewSlug);
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "adopt") {
    const { sdlcAdopt } = await import("../../sdlc/adopt.js");
    const result = sdlcAdopt(sdlcRoot);
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  if (commandArgs.sdlcCommand === "release") {
    const { runRelease } = await import("../../sdlc/release.js");
    const result = runRelease(sdlcRoot, {
      appVersion,
      sinceTag,
      dryRun,
      actor
    });
    console.log(stableStringify(result));
    return result.ok ? 0 : 1;
  }

  throw new Error(`Unknown sdlc command '${commandArgs.sdlcCommand}'`);
}
