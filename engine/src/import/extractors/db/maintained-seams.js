// @ts-check

import path from "node:path";

import { findPrimaryImportFiles, isPrimaryImportSource, makeCandidateRecord, relativeTo } from "../../core/shared.js";

/** @param {string} value @returns {string} */
function toPosix(value) {
  return String(value || "").replaceAll(path.sep, "/");
}

/** @param {any} context @param {string} filePath @returns {string} */
function appRelativePath(context, filePath) {
  return toPosix(relativeTo(context.paths.workspaceRoot, filePath));
}

/** @param {any} context @param {string} filePath @returns {string} */
function evidencePath(context, filePath) {
  return toPosix(relativeTo(context.paths.repoRoot, filePath));
}

/** @param {string} relativePath @param {string[]} segments @returns {string|null} */
function prefixThroughSegments(relativePath, segments) {
  const parts = toPosix(relativePath).split("/");
  for (let index = 0; index <= parts.length - segments.length; index += 1) {
    if (segments.every((segment, offset) => parts[index + offset] === segment)) {
      return parts.slice(0, index + segments.length).join("/");
    }
  }
  return null;
}

/** @param {string} relativePath @returns {string|null} */
function migrationDirectoryFromRelativePath(relativePath) {
  return prefixThroughSegments(relativePath, ["migrations"]) ||
    prefixThroughSegments(relativePath, ["migration"]);
}

/** @param {any} context @param {string[]} files @param {string[][]} markers @returns {string|null} */
function firstMarkedDirectory(context, files, markers) {
  const directories = new Set();
  for (const filePath of files) {
    const relativePath = appRelativePath(context, filePath);
    for (const marker of markers) {
      const directory = prefixThroughSegments(relativePath, marker);
      if (directory) {
        directories.add(directory);
      }
    }
  }
  return [...directories].sort()[0] || null;
}

/** @param {any} context @param {string[]} configFiles @returns {string|null} */
function drizzleOutPathFromConfig(context, configFiles) {
  for (const configFile of configFiles.sort()) {
    const configText = context.helpers.readTextIfExists(configFile) || "";
    const outMatch = configText.match(/\bout\s*:\s*["'`]([^"'`]+)["'`]/);
    if (!outMatch) {
      continue;
    }
    const absoluteOut = path.resolve(path.dirname(configFile), outMatch[1]);
    const relativeOut = appRelativePath(context, absoluteOut);
    if (relativeOut && !relativeOut.startsWith("..")) {
      return relativeOut;
    }
  }
  return null;
}

/**
 * @param {any} context
 * @param {{ tool: "sql"|"prisma"|"drizzle", schemaPath?: string|null, migrationsPath?: string|null, evidence: string[], matchReasons: string[], missingDecisions: string[] }} options
 * @returns {any}
 */
function maintainedDbSeamCandidate(context, options) {
  const runtimeId = "app_db";
  const projectionId = "proj_db";
  const snapshotPath = `topo/state/db/${runtimeId}/current.snapshot.json`;
  const proposedRuntimeMigration = {
    ownership: "maintained",
    tool: options.tool,
    apply: "never",
    snapshotPath,
    ...(options.schemaPath ? { schemaPath: options.schemaPath } : {}),
    ...(options.migrationsPath ? { migrationsPath: options.migrationsPath } : {})
  };
  const idHint = `seam_${options.tool}_db_migrations`;
  const manualNextSteps = [
    "Review evidence, match_reasons, and missing_decisions before accepting this seam.",
    `Confirm database runtime '${runtimeId}' and projection '${projectionId}' are the right topology targets for the maintained app.`,
    "If accepted, copy proposed_runtime_migration into the matching database runtime's migration block in topogram.project.json.",
    "Keep ownership 'maintained' and apply 'never'; import must not apply migrations or patch maintained app files.",
    "After editing topogram.project.json, run topogram check . --json and the maintained app's migration verification."
  ];

  return makeCandidateRecord({
    kind: "maintained_db_migration_seam",
    idHint,
    label: `${options.tool.toUpperCase()} maintained database migrations`,
    confidence: options.missingDecisions.length === 0 ? "high" : "medium",
    sourceKind: "migration_strategy_inference",
    sourceOfTruth: "candidate",
    provenance: options.evidence,
    track: "db",
    seam_id: idHint,
    output_id: "maintained_app",
    ownership_class: "human_owned",
    status: "review_required",
    tool: options.tool,
    ownership: "maintained",
    apply: "never",
    schemaPath: options.schemaPath || null,
    migrationsPath: options.migrationsPath || null,
    snapshotPath,
    runtime_id_hint: runtimeId,
    projection_id_hint: projectionId,
    evidence: options.evidence,
    match_reasons: options.matchReasons,
    missing_decisions: options.missingDecisions,
    proposed_runtime_migration: proposedRuntimeMigration,
    manual_next_steps: manualNextSteps,
    project_config_target: {
      file: "topogram.project.json",
      path: `topology.runtimes[id=${runtimeId}].migration`,
      runtime_id: runtimeId,
      projection_id: projectionId
    },
    maintained_modules: [options.schemaPath, options.migrationsPath].filter(Boolean),
    emitted_dependencies: [snapshotPath, projectionId],
    allowed_change_classes: ["proposal_only"],
    drift_signals: ["schema_or_migration_changed", "migration_directory_changed"]
  });
}

/** @param {any} context @param {string[]} prismaFiles @returns {any[]} */
export function inferPrismaMaintainedDbSeams(context, prismaFiles) {
  if (!prismaFiles.length) {
    return [];
  }
  const schemaPath = appRelativePath(context, prismaFiles[0]);
  const migrationFiles = /** @type {string[]} */ (findPrimaryImportFiles(context.paths, /** @param {string} filePath */ (filePath) =>
    toPosix(filePath).includes("/prisma/migrations/") &&
    isPrimaryImportSource(context.paths, filePath)
  ));
  const migrationsPath = firstMarkedDirectory(context, migrationFiles, [["prisma", "migrations"]]);
  return [
    maintainedDbSeamCandidate(context, {
      tool: "prisma",
      schemaPath,
      migrationsPath,
      evidence: [
        ...prismaFiles.map((filePath) => evidencePath(context, filePath)),
        ...migrationFiles.slice(0, 3).map(/** @param {string} filePath */ (filePath) => evidencePath(context, filePath))
      ],
      matchReasons: [
        "found Prisma schema",
        ...(migrationsPath ? ["found Prisma migrations directory"] : [])
      ],
      missingDecisions: migrationsPath ? [] : ["confirm Prisma migrationsPath before adding this strategy to topogram.project.json"]
    })
  ];
}

/** @param {any} context @param {string[]} schemaFiles @returns {any[]} */
export function inferDrizzleMaintainedDbSeams(context, schemaFiles) {
  if (!schemaFiles.length) {
    return [];
  }
  const configFiles = /** @type {string[]} */ (findPrimaryImportFiles(context.paths, /** @param {string} filePath */ (filePath) =>
    /drizzle\.config\.(ts|js|mjs|cjs)$/i.test(path.basename(filePath)) &&
    isPrimaryImportSource(context.paths, filePath)
  ));
  const drizzleFiles = /** @type {string[]} */ (findPrimaryImportFiles(context.paths, /** @param {string} filePath */ (filePath) =>
    appRelativePath(context, filePath).startsWith("drizzle/") &&
    isPrimaryImportSource(context.paths, filePath)
  ));
  const configuredOutPath = drizzleOutPathFromConfig(context, configFiles);
  const migrationsPath = configuredOutPath ||
    firstMarkedDirectory(context, drizzleFiles, [["drizzle"]]);
  return [
    maintainedDbSeamCandidate(context, {
      tool: "drizzle",
      schemaPath: appRelativePath(context, schemaFiles[0]),
      migrationsPath,
      evidence: [
        ...schemaFiles.map((filePath) => evidencePath(context, filePath)),
        ...configFiles.map(/** @param {string} filePath */ (filePath) => evidencePath(context, filePath)),
        ...drizzleFiles.slice(0, 3).map(/** @param {string} filePath */ (filePath) => evidencePath(context, filePath))
      ],
      matchReasons: [
        "found Drizzle schema source",
        ...(configFiles.length ? ["found Drizzle config"] : []),
        ...(migrationsPath ? ["found Drizzle migrations output"] : [])
      ],
      missingDecisions: migrationsPath ? [] : ["confirm Drizzle migrationsPath before adding this strategy to topogram.project.json"]
    })
  ];
}

/** @param {any} context @param {string[]} allSqlFiles @param {string[]} selectedSqlFiles @returns {any[]} */
export function inferSqlMaintainedDbSeams(context, allSqlFiles, selectedSqlFiles) {
  if (!allSqlFiles.length) {
    return [];
  }
  const schemaFile = selectedSqlFiles.find((filePath) => !/migration/i.test(path.basename(filePath))) ||
    allSqlFiles.find((filePath) => /schema/i.test(path.basename(filePath))) ||
    null;
  const migrationFiles = allSqlFiles.filter((filePath) => {
    const relativePath = appRelativePath(context, filePath);
    return Boolean(migrationDirectoryFromRelativePath(relativePath)) || /migration/i.test(path.basename(filePath));
  });
  const migrationsPath = firstMarkedDirectory(context, migrationFiles, [["migrations"], ["migration"]]) ||
    (migrationFiles.length ? toPosix(path.dirname(appRelativePath(context, migrationFiles[0]))) : null);
  return [
    maintainedDbSeamCandidate(context, {
      tool: "sql",
      schemaPath: schemaFile ? appRelativePath(context, schemaFile) : null,
      migrationsPath,
      evidence: [
        ...(schemaFile ? [evidencePath(context, schemaFile)] : []),
        ...migrationFiles.slice(0, 3).map((filePath) => evidencePath(context, filePath))
      ],
      matchReasons: [
        ...(schemaFile ? ["found SQL schema"] : []),
        ...(migrationsPath ? ["found SQL migrations directory or migration file"] : [])
      ],
      missingDecisions: migrationsPath ? [] : ["confirm SQL migrationsPath before adding this strategy to topogram.project.json"]
    })
  ];
}
