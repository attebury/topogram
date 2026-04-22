import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  normalizeImportRelativePath,
  pluralizeCandidateTerm,
  readJsonIfExists,
  readTextIfExists,
  slugify,
  titleCase
} from "../../core/shared.js";

const JS_TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const PYTHON_TEST_PATTERN = /(^|\/)(test_[^/]+|[^/]+_test)\.py$/i;
const RUBY_TEST_PATTERN = /(^|\/)[^/]+_spec\.rb$/i;
const SWIFT_TEST_PATTERN = /(^|\/)[^/]*Tests?\.swift$/i;

function frameworkInfo(context) {
  const packageFiles = findImportFiles(context.paths, (filePath) => /package\.json$/i.test(filePath));
  const frameworks = new Set();
  const scripts = [];

  for (const packagePath of packageFiles) {
    const pkg = readJsonIfExists(packagePath);
    if (!pkg) continue;
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {})
    };
    if (deps["@playwright/test"] || deps.playwright) frameworks.add("playwright");
    if (deps.vitest) frameworks.add("vitest");
    if (deps.jest) frameworks.add("jest");
    if (deps.cypress) frameworks.add("cypress");

    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      if (!/^test($|[-:])/.test(name) && !/(playwright|vitest|jest|cypress|pytest|rspec)/i.test(String(command || ""))) {
        continue;
      }
      scripts.push({
        name,
        command,
        file: normalizeImportRelativePath(context.paths, packagePath)
      });
    }
  }

  const configFiles = findImportFiles(
    context.paths,
    (filePath) => /(playwright\.config|vitest\.config|jest\.config|cypress\.config)\.(ts|js|mjs|cjs)$/i.test(filePath)
  );
  for (const filePath of configFiles) {
    const lower = filePath.toLowerCase();
    if (lower.includes("playwright")) frameworks.add("playwright");
    if (lower.includes("vitest")) frameworks.add("vitest");
    if (lower.includes("jest")) frameworks.add("jest");
    if (lower.includes("cypress")) frameworks.add("cypress");
  }

  return {
    frameworks: [...frameworks].sort(),
    scripts: scripts.sort((left, right) => left.name.localeCompare(right.name) || left.file.localeCompare(right.file))
  };
}

function findTestFiles(context) {
  return findImportFiles(context.paths, (filePath) => {
    const normalized = filePath.replaceAll("\\", "/");
    return (
      JS_TEST_PATTERN.test(normalized) ||
      PYTHON_TEST_PATTERN.test(normalized) ||
      RUBY_TEST_PATTERN.test(normalized) ||
      SWIFT_TEST_PATTERN.test(normalized) ||
      /\/playwright\/.+\.(ts|tsx|js|jsx)$/i.test(normalized) ||
      /\/cypress\/.+\.(ts|tsx|js|jsx)$/i.test(normalized)
    );
  });
}

function inferFramework(filePath, frameworks) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("/playwright/")) return "playwright";
  if (normalized.includes("/cypress/")) return "cypress";
  if (normalized.endsWith(".py")) return "pytest";
  if (normalized.endsWith("_spec.rb")) return "rspec";
  if (normalized.endsWith(".swift")) return "xctest";
  if (frameworks.includes("vitest")) return "vitest";
  if (frameworks.includes("jest")) return "jest";
  return "test";
}

function inferMethod(filePath, framework) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  if (framework === "playwright" || framework === "cypress") {
    return normalized.includes("smoke") ? "smoke" : "runtime";
  }
  if (normalized.includes("/e2e/") || normalized.includes("/integration/")) {
    return "runtime";
  }
  return "contract";
}

function extractScenarioTitles(source, filePath) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  const titles = [];

  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(normalized)) {
    for (const match of source.matchAll(/\b(?:test|it|describe)\(\s*['"`]([^'"`]+)['"`]/g)) {
      titles.push(match[1]);
    }
  } else if (normalized.endsWith(".py")) {
    for (const match of source.matchAll(/\bdef\s+(test_[a-zA-Z0-9_]+)\s*\(/g)) {
      titles.push(match[1].replace(/^test_/, "").replaceAll("_", " "));
    }
  } else if (normalized.endsWith(".rb")) {
    for (const match of source.matchAll(/\bit\s+['"]([^'"]+)['"]/g)) {
      titles.push(match[1]);
    }
  } else if (normalized.endsWith(".swift")) {
    for (const match of source.matchAll(/\bfunc\s+(test[A-Za-z0-9_]+)\s*\(/g)) {
      titles.push(match[1].replace(/^test/, "").replace(/([A-Z])/g, " $1").trim());
    }
  }

  return [...new Set(titles)];
}

function capabilityMatchers(apiCandidates = []) {
  return (apiCandidates.capabilities || []).map((capability) => {
    const entityStem = canonicalCandidateTerm(
      String(capability.entity_id || capability.id_hint || "").replace(/^entity_/, "").replace(/^cap_[a-z]+_/, "")
    );
    const terms = new Set([
      entityStem,
      pluralizeCandidateTerm(entityStem),
      ...String(capability.label || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
      ...String(capability.id_hint || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    ]);
    return { capability, terms: [...terms].filter(Boolean) };
  });
}

function inferRelatedCapabilities(text, matchers) {
  const normalized = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return matchers
    .filter(({ terms }) => terms.some((term) => term && normalized.includes(` ${term} `)))
    .map(({ capability }) => capability.id_hint)
    .sort();
}

function scenarioAction(title) {
  const normalized = String(title || "").toLowerCase();
  for (const [needle, action] of [
    ["create", "create"],
    ["add ", "create"],
    ["new ", "create"],
    ["list", "list"],
    ["index", "list"],
    ["get ", "get"],
    ["view", "get"],
    ["show", "get"],
    ["update", "update"],
    ["edit", "update"],
    ["delete", "delete"],
    ["remove", "delete"],
    ["approve", "approve"],
    ["reject", "reject"],
    ["close", "close"],
    ["complete", "complete"],
    ["export", "export"],
    ["download", "download"],
    ["revision", "request_revision"]
  ]) {
    if (normalized.includes(needle)) return action;
  }
  return null;
}

function refineScenarioCapabilities(title, capabilityIds) {
  const action = scenarioAction(title);
  if (!action) {
    return capabilityIds;
  }
  const matching = capabilityIds.filter((id) => id.startsWith(`cap_${action}_`));
  return matching.length > 0 ? matching : capabilityIds;
}

export const genericVerificationExtractor = {
  id: "verification.generic",
  track: "verification",
  detect(context) {
    const { frameworks } = frameworkInfo(context);
    const testFiles = findTestFiles(context);
    if (frameworks.length === 0 && testFiles.length === 0) {
      return { score: 0, reasons: [] };
    }
    return {
      score: Math.min(95, 40 + frameworks.length * 10 + Math.min(testFiles.length, 8) * 4),
      reasons: [
        frameworks.length > 0 ? `detected frameworks: ${frameworks.join(", ")}` : null,
        testFiles.length > 0 ? `detected ${testFiles.length} test file(s)` : null
      ].filter(Boolean)
    };
  },
  extract(context) {
    const { frameworks, scripts } = frameworkInfo(context);
    const files = findTestFiles(context);
    const apiImport = context.priorResults.api || { candidates: { capabilities: [] } };
    const matchers = capabilityMatchers(apiImport.candidates);
    const findings = [];
    const candidates = {
      verifications: [],
      scenarios: [],
      frameworks,
      scripts
    };

    for (const filePath of files) {
      const source = readTextIfExists(filePath) || "";
      const relativePath = normalizeImportRelativePath(context.paths, filePath);
      const framework = inferFramework(filePath, frameworks);
      const method = inferMethod(filePath, framework);
      const titles = extractScenarioTitles(source, filePath);
      const fileLabel = titleCase(pathStem(filePath));
      const relatedCapabilities = inferRelatedCapabilities(`${relativePath}\n${source}`, matchers);
      const verificationId = `verification_${idHintify(`${framework}_${relativePath}`)}`;
      const scenarioIds = [];

      for (const [index, title] of (titles.length > 0 ? titles : [fileLabel]).entries()) {
        const scenarioId = `verification_scenario_${idHintify(`${framework}_${relativePath}_${title}`) || `${verificationId}_${index + 1}`}`;
        const scenarioCapabilities = refineScenarioCapabilities(title, relatedCapabilities);
        scenarioIds.push(scenarioId);
        candidates.scenarios.push(makeCandidateRecord({
          kind: "verification_scenario",
          idHint: scenarioId,
          label: title,
          confidence: scenarioCapabilities.length > 0 ? "medium" : "low",
          sourceKind: "test_suite",
          provenance: relativePath,
          track: "verification",
          framework,
          method,
          file_path: relativePath,
          verification_id: verificationId,
          related_capabilities: scenarioCapabilities
        }));
      }

      candidates.verifications.push(makeCandidateRecord({
        kind: "verification",
        idHint: verificationId,
        label: fileLabel,
        confidence: relatedCapabilities.length > 0 ? "medium" : "low",
        sourceKind: "test_suite",
        provenance: relativePath,
        track: "verification",
        framework,
        method,
        file_path: relativePath,
        scenario_ids: scenarioIds,
        related_capabilities: relatedCapabilities,
        runner_scripts: scripts
          .filter((script) => /(test|playwright|vitest|jest|cypress|pytest|rspec)/i.test(script.name) || /(playwright|vitest|jest|cypress|pytest|rspec)/i.test(script.command))
          .map((script) => script.name)
      }));
    }

    candidates.verifications = dedupeCandidateRecords(candidates.verifications, (record) => record.id_hint);
    candidates.scenarios = dedupeCandidateRecords(candidates.scenarios, (record) => record.id_hint);

    findings.push({
      kind: "verification_import",
      framework_count: frameworks.length,
      test_file_count: files.length,
      verification_count: candidates.verifications.length,
      scenario_count: candidates.scenarios.length
    });

    return { findings, candidates };
  }
};

function pathStem(filePath) {
  const base = String(filePath || "").replaceAll("\\", "/").split("/").pop() || "verification";
  return base
    .replace(/\.(test|spec)\.[^.]+$/i, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[_-]+/g, " ");
}
