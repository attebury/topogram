// @ts-check

import fs from "node:fs";
import path from "node:path";

import { FIRST_PARTY_EXTRACTOR_PACKAGES, firstPartyExtractorInfo } from "./first-party.js";
import { EXTRACTOR_MANIFESTS, EXTRACTOR_TRACKS, packageExtractorInstallCommand } from "./registry.js";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".svelte-kit",
  ".topogram",
  ".turbo"
]);

/**
 * @param {string} value
 * @returns {string[]}
 */
function parseTracks(value) {
  if (!value) return [...EXTRACTOR_TRACKS];
  return value
    .split(",")
    .map((track) => track.trim())
    .filter(Boolean)
    .filter((track, index, tracks) => EXTRACTOR_TRACKS.includes(track) && tracks.indexOf(track) === index);
}

/**
 * @param {string} root
 * @param {string} filePath
 * @returns {string}
 */
function relativePath(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/") || ".";
}

/**
 * @param {string} sourcePath
 * @param {string} cwd
 * @returns {string}
 */
function displayPath(sourcePath, cwd) {
  const absolute = path.resolve(cwd, sourcePath || ".");
  const relative = path.relative(cwd, absolute).replace(/\\/g, "/");
  if (!relative || relative === "") return ".";
  return relative.startsWith("..") ? sourcePath : `./${relative}`;
}

/**
 * @param {string} filePath
 * @returns {string|null}
 */
function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @param {string[]} [files]
 * @returns {Record<string, any>|null}
 */
function readPackageJson(root, files = []) {
  const packagePath = path.join(root, "package.json");
  const text = readText(packagePath);
  if (!text) return null;
  try {
    const packageJson = JSON.parse(text);
    files.push(relativePath(root, packagePath));
    return packageJson && typeof packageJson === "object" && !Array.isArray(packageJson) ? packageJson : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, any>|null} packageJson
 * @param {string} dependency
 * @returns {boolean}
 */
function hasDependency(packageJson, dependency) {
  if (!packageJson) return false;
  for (const bucket of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const dependencies = packageJson[bucket];
    if (dependencies && typeof dependencies === "object" && !Array.isArray(dependencies) && dependencies[dependency]) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} root
 * @param {number} [limit]
 * @returns {string[]}
 */
function listSourceFiles(root, limit = 800) {
  /** @type {string[]} */
  const files = [];
  /**
   * @param {string} dir
   */
  function visit(dir) {
    if (files.length >= limit) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= limit) return;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }
  visit(root);
  return files.sort();
}

/**
 * @param {string} root
 * @param {string[]} files
 * @param {RegExp} pattern
 * @param {RegExp} [filePattern]
 * @returns {string[]}
 */
function filesMatchingContent(root, files, pattern, filePattern = /\.(cjs|mjs|js|jsx|ts|tsx|java|mxml|as|cs|sql|prisma)$/i) {
  const matches = [];
  for (const file of files) {
    const relative = relativePath(root, file);
    if (!filePattern.test(relative)) continue;
    const text = readText(file);
    if (text && pattern.test(text)) {
      matches.push(relative);
      if (matches.length >= 5) break;
    }
  }
  return matches;
}

/**
 * @param {string} root
 * @param {string[]} files
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function filesMatchingPath(root, files, pattern) {
  return files
    .map((file) => relativePath(root, file))
    .filter((relative) => pattern.test(relative))
    .slice(0, 5);
}

/**
 * @param {string} packageName
 * @param {{ sourceDisplay: string, confidence: string, reasons: string[], evidence: string[] }} options
 * @returns {Record<string, any>|null}
 */
function packageRecommendation(packageName, options) {
  const firstParty = firstPartyExtractorInfo(packageName);
  if (!firstParty) return null;
  const trackList = firstParty.tracks.join(",");
  return {
    id: firstParty.id,
    package: firstParty.package,
    label: firstParty.label,
    tracks: firstParty.tracks,
    source: "package",
    knownFirstParty: true,
    confidence: options.confidence,
    reasons: options.reasons,
    evidence: options.evidence,
    packageCodeLoaded: false,
    executesPackageCode: false,
    installCommand: packageExtractorInstallCommand(firstParty.package),
    showCommand: `topogram extractor show ${firstParty.package}`,
    policyPinCommand: `topogram extractor policy pin ${firstParty.package}@${firstParty.version || "1"}`,
    checkCommand: `topogram extractor check ${firstParty.package}`,
    extractCommand: `topogram extract ${options.sourceDisplay} --out ./extracted-topogram --from ${trackList} --extractor ${firstParty.package}`
  };
}

/**
 * @param {string[]} selectedTracks
 * @param {string} sourceDisplay
 * @returns {Record<string, any>[]}
 */
function bundledRecommendations(selectedTracks, sourceDisplay) {
  return EXTRACTOR_MANIFESTS
    .filter((manifest) => manifest.source === "bundled" && manifest.tracks.some((track) => selectedTracks.includes(track)))
    .map((manifest) => ({
      id: manifest.id,
      source: "bundled",
      tracks: manifest.tracks,
      packageCodeLoaded: false,
      executesPackageCode: false,
      extractors: manifest.extractors,
      candidateKinds: manifest.candidateKinds,
      extractCommand: `topogram extract ${sourceDisplay} --out ./extracted-topogram --from ${manifest.tracks.filter((track) => selectedTracks.includes(track)).join(",")}`
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * @param {string} sourcePath
 * @param {{ cwd?: string, from?: string|null }} [options]
 * @returns {Record<string, any>}
 */
export function recommendExtractors(sourcePath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const root = path.resolve(cwd, sourcePath || ".");
  const sourceDisplay = displayPath(sourcePath || ".", cwd);
  const selectedTracks = parseTracks(options.from || "");
  if (!fs.existsSync(root)) {
    return {
      ok: false,
      type: "extractor_recommendations",
      sourceRoot: root,
      source: sourceDisplay,
      selectedTracks,
      bundled: [],
      recommendations: [],
      safety: {
        packageCodeLoaded: false,
        note: "Extractor recommendation only reads local file names, package metadata, and lightweight source snippets."
      },
      errors: [`Source path '${root}' does not exist.`]
    };
  }

  const files = listSourceFiles(root);
  /** @type {string[]} */
  const packageEvidence = [];
  const packageJson = readPackageJson(root, packageEvidence);
  /** @type {Record<string, any>[]} */
  const recommendations = [];

  /**
   * @param {string} track
   * @param {string} packageName
   * @param {{ confidence: string, reasons: string[], evidence: string[] }} recommendation
   */
  function add(track, packageName, recommendation) {
    if (!selectedTracks.includes(track) || recommendation.evidence.length === 0) return;
    const item = packageRecommendation(packageName, {
      sourceDisplay,
      confidence: recommendation.confidence,
      reasons: recommendation.reasons,
      evidence: recommendation.evidence
    });
    if (item && !recommendations.some((existing) => existing.package === item.package)) {
      recommendations.push(item);
    }
  }

  const prismaEvidence = [
    ...filesMatchingPath(root, files, /^prisma\/schema\.prisma$/),
    ...filesMatchingPath(root, files, /^prisma\/migrations\/.+\/migration\.sql$/)
  ];
  add("db", "@topogram/extractor-prisma-db", {
    confidence: prismaEvidence.some((file) => file.includes("migrations/")) ? "high" : "medium",
    reasons: ["Prisma schema or migration files were found."],
    evidence: prismaEvidence
  });

  const drizzleEvidence = [
    ...filesMatchingPath(root, files, /^drizzle\.config\.(js|cjs|mjs|ts)$/),
    ...filesMatchingPath(root, files, /^drizzle\/.+/),
    ...filesMatchingContent(root, files, /drizzle-orm|pgTable|sqliteTable|mysqlTable/)
  ];
  add("db", "@topogram/extractor-drizzle-db", {
    confidence: drizzleEvidence.some((file) => /^drizzle\.config\./.test(file)) ? "high" : "medium",
    reasons: ["Drizzle config, migration output, or schema table definitions were found."],
    evidence: drizzleEvidence
  });

  const expressEvidence = [
    ...(hasDependency(packageJson, "express") ? packageEvidence : []),
    ...filesMatchingContent(root, files, /from\s+["']express["']|require\(["']express["']\)|express\.Router|app\.(get|post|put|patch|delete)\s*\(/)
  ];
  add("api", "@topogram/extractor-express-api", {
    confidence: hasDependency(packageJson, "express") ? "high" : "medium",
    reasons: ["Express dependency, route handlers, or router usage were found."],
    evidence: expressEvidence
  });

  const reactRouterEvidence = [
    ...(hasDependency(packageJson, "react-router") || hasDependency(packageJson, "react-router-dom") ? packageEvidence : []),
    ...filesMatchingContent(root, files, /react-router|createBrowserRouter|createRoutesFromElements|<Route\b/)
  ];
  add("ui", "@topogram/extractor-react-router", {
    confidence: hasDependency(packageJson, "react-router") || hasDependency(packageJson, "react-router-dom") ? "high" : "medium",
    reasons: ["React Router dependency or route definitions were found."],
    evidence: reactRouterEvidence
  });

  const nodeCliEvidence = [
    ...(packageJson && packageJson.bin ? packageEvidence : []),
    ...filesMatchingContent(root, files, /commander|yargs|cac\(|process\.argv|program\.command/)
  ];
  add("cli", "@topogram/extractor-node-cli", {
    confidence: packageJson && packageJson.bin ? "high" : "medium",
    reasons: ["Node package bin metadata or CLI parser usage was found."],
    evidence: nodeCliEvidence
  });

  recommendations.sort((left, right) => String(left.package).localeCompare(String(right.package)));

  return {
    ok: true,
    type: "extractor_recommendations",
    sourceRoot: root,
    source: sourceDisplay,
    selectedTracks,
    safety: {
      packageCodeLoaded: false,
      note: "Extractor recommendation only reads local file names, package metadata, and lightweight source snippets."
    },
    bundled: bundledRecommendations(selectedTracks, sourceDisplay),
    recommendations,
    firstPartyPackages: FIRST_PARTY_EXTRACTOR_PACKAGES.map((item) => ({
      package: item.package,
      label: item.label,
      tracks: item.tracks,
      useWhen: item.useWhen
    })),
    nextCommands: [
      `topogram extract ${sourceDisplay} --out ./extracted-topogram --from ${selectedTracks.join(",")}`,
      ...(recommendations.length > 0 ? [
        recommendations[0].installCommand,
        recommendations[0].policyPinCommand,
        recommendations[0].checkCommand,
        recommendations[0].extractCommand
      ].filter(Boolean) : ["topogram extractor list"])
    ],
    errors: []
  };
}
