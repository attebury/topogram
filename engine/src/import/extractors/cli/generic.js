// @ts-check

import path from "node:path";

import {
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  normalizeImportRelativePath,
  readJsonIfExists,
  readTextIfExists,
  titleCase
} from "../../core/shared.js";

const CLI_SOURCE_PATTERN = /(^|\/)(bin|cli|command|commands|parser|help)(\/|[-_.A-Za-z0-9]*\.(?:js|mjs|cjs|ts))$/i;
const JS_SOURCE_PATTERN = /\.(?:js|mjs|cjs|ts)$/i;
const NON_AUTHORITATIVE_CLI_PATH_PATTERN = /(^|\/)(test|tests|__tests__|fixtures|fixture|expected|snapshots|snapshot|mock|mocks|candidates|docs-generated)(\/|$)|\.(?:test|spec)\.(?:js|mjs|cjs|ts)$/i;

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

/**
 * CLI import should prefer public command surfaces, not tests or fixture strings
 * that happen to look like command help.
 * @param {any} paths
 * @param {string} filePath
 * @returns {boolean}
 */
function isAuthoritativeCliSource(paths, filePath) {
  const normalized = normalizePath(normalizeImportRelativePath(paths, filePath));
  return !NON_AUTHORITATIVE_CLI_PATH_PATTERN.test(normalized);
}

/**
 * @param {string} commandId
 * @returns {string}
 */
function capabilityIdForCommand(commandId) {
  return `cap_${idHintify(commandId)}`;
}

/**
 * @param {string} rawLine
 * @returns {{ text: string, terminalOutput: boolean }}
 */
function normalizePotentialHelpLine(rawLine) {
  const trimmed = rawLine.trim();
  const terminalOutput = /^(?:console\.(?:log|error|warn)|print)\(\s*["'`]/.test(trimmed) || /^echo\s+["'`]/.test(trimmed);
  return {
    terminalOutput,
    text: trimmed
      .replace(/^\s*(?:console\.(?:log|error|warn)\(|print\(|echo\s+)?["'`]*/, "")
      .replace(/["'`),;]*\s*$/, "")
      .trim()
  };
}

/**
 * @param {string} text
 * @param {Set<string>} binNames
 * @returns {string[]}
 */
function extractUsageLines(text, binNames) {
  const lines = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const { text: line, terminalOutput } = normalizePotentialHelpLine(rawLine);
    if (!line) continue;
    const usageMatch = line.match(/(?:^|\b)Usage:\s*(.+)$/i);
    if (usageMatch?.[1]) {
      lines.push(usageMatch[1].trim());
      continue;
    }
    const firstToken = line.split(/\s+/)[0];
    if (
      terminalOutput &&
      (binNames.size === 0 || binNames.has(firstToken)) &&
      /^[a-zA-Z][\w.-]+(?:\s+[a-zA-Z][\w:-]+)+(?:\s|$)/.test(line) &&
      /(?:--[a-zA-Z][\w:-]*|<[^>]+>|\[[^\]]+\])/.test(line)
    ) {
      lines.push(line);
    }
  }
  return [...new Set(lines)].sort();
}

/**
 * @param {string} usage
 * @param {Set<string>} binNames
 * @returns {{ id: string, commandPath: string[] } | null}
 */
function commandIdFromUsage(usage, binNames) {
  const tokens = usage.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }
  const firstCommandToken = binNames.has(tokens[0]) ? 1 : 0;
  const commandPath = [];
  for (let index = firstCommandToken; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || token.startsWith("-") || token.startsWith("[") || token.startsWith("<")) {
      break;
    }
    commandPath.push(token.replace(/[^a-zA-Z0-9:_-]/g, ""));
  }
  if (commandPath.length === 0) {
    return null;
  }
  return {
    id: idHintify(commandPath.join("_")),
    commandPath
  };
}

/**
 * @param {string} usage
 * @param {string} commandId
 * @returns {any[]}
 */
function optionsFromUsage(usage, commandId) {
  const options = [];
  const optionPattern = /--([a-zA-Z][\w:-]*)(?:\s+(<[^>]+>|\[[^\]]+\]))?/g;
  for (const match of usage.matchAll(optionPattern)) {
    const optionName = idHintify(match[1]);
    options.push({
      command_id: commandId,
      name: optionName,
      flag: `--${match[1]}`,
      type: match[2] ? "string" : "boolean",
      required: false,
      values: [],
      description: null
    });
  }
  return options;
}

/**
 * @param {string} commandId
 * @param {string} usage
 * @param {string} sourceText
 * @returns {string[]}
 */
function effectsForCommand(commandId, usage, sourceText) {
  const text = `${commandId} ${usage}`.toLowerCase();
  const effects = new Set();
  if (/\b(check|list|show|help|doctor|status|brief|explain|query|emit)\b/.test(text)) {
    effects.add("read_only");
  }
  if (/\b(import|adopt|new|generate|refresh|update|write|create|copy)\b/.test(text)) {
    effects.add("writes_workspace");
    effects.add("filesystem");
  }
  if (/\b(fetch|https?:\/\/|github|gh_token|github_token|network|catalog)\b/.test(text)) {
    effects.add("network");
  }
  if (/\b(npm|package|install|publish|pack)\b/.test(text)) {
    effects.add("package_install");
  }
  if (/\b(git|worktree|commit|push|pull|checkout|branch)\b/.test(text)) {
    effects.add("git");
  }
  if (effects.size === 0) {
    effects.add("read_only");
  }
  return [...effects].sort();
}

/**
 * @param {string} commandId
 * @param {any[]} options
 * @returns {any[]}
 */
function outputsForCommand(commandId, options) {
  const hasJson = options.some((option) => option.command_id === commandId && option.name === "json");
  return [
    ...(hasJson ? [{ command_id: commandId, format: "json", schema_id: null, description: "Machine-readable JSON output" }] : []),
    { command_id: commandId, format: "human", schema_id: null, description: "Human-readable terminal output" }
  ];
}

/**
 * @param {any[]} records
 * @param {(record: any) => string} keyFn
 * @returns {any[]}
 */
function dedupeRecords(records, keyFn) {
  const seen = new Set();
  const deduped = [];
  for (const record of records) {
    const key = keyFn(record);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
  }
  return deduped;
}

/**
 * @param {any} context
 * @param {string[]} packageFiles
 * @returns {{ binNames: Set<string>, binTargets: Set<string>, findings: any[], provenance: string[] }}
 */
function inspectPackageCliMetadata(context, packageFiles) {
  const binNames = new Set();
  const binTargets = new Set();
  const findings = [];
  const provenance = [];

  for (const packagePath of packageFiles) {
    const pkg = readJsonIfExists(packagePath);
    if (!pkg) continue;
    const relPath = normalizeImportRelativePath(context.paths, packagePath);
    const bin = pkg.bin;
    if (typeof bin === "string") {
      const binName = pkg.name ? String(pkg.name).split("/").pop() : "cli";
      binNames.add(binName);
      binTargets.add(path.resolve(path.dirname(packagePath), bin));
      provenance.push(`${relPath}#bin`);
    } else if (bin && typeof bin === "object") {
      for (const [name, target] of Object.entries(bin)) {
        binNames.add(name);
        if (typeof target === "string") {
          binTargets.add(path.resolve(path.dirname(packagePath), target));
        }
      }
      provenance.push(`${relPath}#bin`);
    }
    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      if (/^(cli|bin|start|check|test|verify)(:|$)/.test(name) || /\b(node|tsx|ts-node)\b.+\b(cli|bin)\b/i.test(String(command))) {
        findings.push({
          kind: "cli_script",
          name,
          command,
          source: relPath
        });
      }
    }
  }

  return { binNames, binTargets, findings, provenance };
}

/**
 * @param {any} context
 * @returns {{ packageFiles: string[], sourceFiles: string[], binNames: Set<string>, findings: any[], provenance: string[] }}
 */
function discoverCliSources(context) {
  const packageFiles = findImportFiles(context.paths, (/** @type {string} */ filePath) => /package\.json$/i.test(filePath));
  const packageMetadata = inspectPackageCliMetadata(context, packageFiles);
  const sourceFiles = findImportFiles(context.paths, (/** @type {string} */ filePath) => {
    const normalized = normalizePath(filePath);
    if (!isAuthoritativeCliSource(context.paths, filePath)) {
      return false;
    }
    return JS_SOURCE_PATTERN.test(normalized) && (
      CLI_SOURCE_PATTERN.test(normalized) ||
      normalized.includes("/src/cli/") ||
      normalized.includes("/commands/")
    );
  });
  for (const binTarget of packageMetadata.binTargets) {
    if (JS_SOURCE_PATTERN.test(binTarget)) {
      sourceFiles.push(binTarget);
    }
  }
  return {
    packageFiles,
    sourceFiles: [...new Set(sourceFiles)].sort(),
    binNames: packageMetadata.binNames,
    findings: packageMetadata.findings,
    provenance: packageMetadata.provenance
  };
}

export const genericCliExtractor = {
  id: "cli.generic",
  track: "cli",
  /** @param {any} context */
  detect(context) {
    const { packageFiles, sourceFiles, binNames } = discoverCliSources(context);
    const hasBin = packageFiles.some((filePath) => {
      const pkg = readJsonIfExists(filePath);
      return Boolean(pkg?.bin);
    });
    const score = (hasBin ? 70 : 0) + Math.min(30, sourceFiles.length * 5);
    return {
      score,
      reasons: [
        hasBin ? `package.json declares ${binNames.size || 1} CLI bin${binNames.size === 1 ? "" : "s"}` : null,
        sourceFiles.length ? `${sourceFiles.length} CLI-like source files found` : null
      ].filter(Boolean)
    };
  },
  /** @param {any} context */
  extract(context) {
    const { sourceFiles, binNames, findings, provenance } = discoverCliSources(context);
    const commands = [];
    const options = [];
    const outputs = [];
    const effects = [];
    const examples = [];
    const capabilities = [];

    for (const sourcePath of sourceFiles) {
      const sourceText = readTextIfExists(sourcePath) || "";
      const relPath = normalizeImportRelativePath(context.paths, sourcePath);
      const usageLines = extractUsageLines(sourceText, binNames);
      if (usageLines.length === 0) {
        continue;
      }
      findings.push({
        kind: "cli_usage",
        source: relPath,
        usages: usageLines
      });
      for (const usage of usageLines) {
        const command = commandIdFromUsage(usage, binNames);
        if (!command) continue;
        const commandOptions = optionsFromUsage(usage, command.id);
        const commandEffects = effectsForCommand(command.id, usage, sourceText);
        const capabilityId = capabilityIdForCommand(command.id);
        const commandProvenance = [`${relPath}#${usage}`];
        commands.push(makeCandidateRecord({
          kind: "cli_command",
          idHint: `cmd_${command.id}`,
          label: titleCase(command.commandPath.join(" ")),
          confidence: "medium",
          sourceKind: "cli_usage",
          sourceOfTruth: "candidate",
          provenance: commandProvenance,
          track: "cli",
          command_id: command.id,
          command_path: command.commandPath,
          capability_id: capabilityId,
          usage,
          mode: commandEffects.includes("writes_workspace") ? "writes_workspace" : commandEffects[0],
          options: commandOptions.map((option) => option.name),
          effects: commandEffects
        }));
        capabilities.push(makeCandidateRecord({
          kind: "capability",
          idHint: capabilityId,
          label: titleCase(command.commandPath.join(" ")),
          confidence: "medium",
          sourceKind: "cli_command",
          sourceOfTruth: "candidate",
          provenance: commandProvenance,
          track: "cli",
          command_id: command.id
        }));
        options.push(...commandOptions.map((option) => ({
          ...option,
          provenance: commandProvenance
        })));
        outputs.push(...outputsForCommand(command.id, commandOptions).map((output) => ({
          ...output,
          provenance: commandProvenance
        })));
        effects.push(...commandEffects.map((effect) => ({
          command_id: command.id,
          effect,
          target: effect === "read_only" ? "workspace" : null,
          provenance: commandProvenance
        })));
        examples.push({
          command_id: command.id,
          example: usage,
          provenance: commandProvenance
        });
      }
    }

    const surfaceCommands = dedupeRecords(commands, (record) => record.command_id);
    const surfaces = surfaceCommands.length > 0
      ? [makeCandidateRecord({
          kind: "cli_surface",
          idHint: "proj_cli_surface",
          label: "CLI Surface",
          confidence: "medium",
          sourceKind: "cli_usage",
          sourceOfTruth: "candidate",
          provenance,
          track: "cli",
          commands: surfaceCommands.map((record) => record.command_id),
          command_records: surfaceCommands,
          options: dedupeRecords(options, (record) => `${record.command_id}:${record.name}`),
          outputs: dedupeRecords(outputs, (record) => `${record.command_id}:${record.format}`),
          effects: dedupeRecords(effects, (record) => `${record.command_id}:${record.effect}`),
          examples: dedupeRecords(examples, (record) => `${record.command_id}:${record.example}`)
        })]
      : [];

    return {
      findings,
      candidates: {
        commands: surfaceCommands,
        capabilities: dedupeRecords(capabilities, (record) => record.id_hint),
        surfaces
      }
    };
  }
};
