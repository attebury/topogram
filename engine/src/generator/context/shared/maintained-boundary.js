import fs from "node:fs";
import path from "node:path";

import { parseDocFile } from "../../../workspace-docs.js";
import {
  ownershipBoundaryForMaintainedSurface,
  reviewBoundaryForMaintainedClassification
} from "../../../policy/review-boundaries.js";
import { seamIdHint, stableSortedStrings, titleCaseWords } from "./primitives.js";
import { buildMaintainedWriteScope, recommendedVerificationTargets } from "./metrics.js";

const bundledRepoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "..");

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function repoRootFromGraph(graph) {
  let current = path.resolve(graph.root);
  while (true) {
    if (fs.existsSync(path.join(current, "examples", "maintained", "proof-app")) && fs.existsSync(path.join(current, "engine"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      if (
        fs.existsSync(path.join(bundledRepoRoot, "examples", "maintained", "proof-app")) &&
        fs.existsSync(path.join(bundledRepoRoot, "engine"))
      ) {
        return bundledRepoRoot;
      }
      return path.resolve(graph.root, "..", "..");
    }
    current = parent;
  }
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} targetPath
 * @returns {any}
 */
export function relativePathFromGraph(graph, targetPath) {
  return path.relative(repoRootFromGraph(graph), targetPath);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
function workspaceRootFromGraph(graph) {
  const root = path.resolve(graph.root);
  return path.basename(root) === "topogram" ? path.dirname(root) : root;
}

/**
 * @param {string} workspaceRoot
 * @returns {any}
 */
function collectMaintainedProofDocPaths(workspaceRoot) {
  const candidateDirs = [
    path.join(workspaceRoot, "proof"),
    path.join(workspaceRoot, "docs", "proof")
  ];
  const proofFiles = [];

  for (const dirPath of candidateDirs) {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      continue;
    }
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isFile() && /^maintained-.*\.md$/.test(entry.name)) {
        proofFiles.push(path.join(dirPath, entry.name));
      }
    }
  }

  return stableSortedStrings(proofFiles);
}

/**
 * @param {string} workspaceRoot
 * @returns {any}
 */
function readLocalMaintainedProofMetadataFromWorkspace(workspaceRoot) {
  return collectMaintainedProofDocPaths(workspaceRoot)
    .map(/** @param {any} filePath */ (filePath) => parseDocFile(filePath, workspaceRoot))
    .filter(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => !doc.parseError)
    .map(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => {
      const classification = doc.metadata.classification || null;
      const maintainedFiles = stableSortedStrings(doc.metadata.maintained_files || []);
      const emittedDependencies = stableSortedStrings(doc.metadata.emitted_dependencies || []);
      const humanOwnedSeams = stableSortedStrings(doc.metadata.human_owned_seams || []);

      if (!classification || maintainedFiles.length === 0 || emittedDependencies.length === 0 || humanOwnedSeams.length === 0) {
        return null;
      }

      return {
        classification,
        maintainedFiles,
        emittedDependencies,
        humanOwnedSeams,
        seamFamilyId: doc.metadata.seam_family_id || null,
        seamFamilyLabel: doc.metadata.seam_family_label || null,
        exists: true,
        absolutePath: doc.file,
        relativePath: doc.relativePath,
        reviewBoundary: reviewBoundaryForMaintainedClassification(classification),
        ownership_boundary: ownershipBoundaryForMaintainedSurface()
      };
    })
    .filter(Boolean);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function readLocalMaintainedProofMetadata(graph) {
  return readLocalMaintainedProofMetadataFromWorkspace(workspaceRootFromGraph(graph));
}

/**
 * @param {import("./types.d.ts").MaintainedBoundaryOptions} arg1
 * @returns {any}
 */
export function buildMaintainedBoundaryArtifact(arg1 = {}) {
  const {
  proofStories = [],
  verificationTargets = null,
  graph = null
  } = arg1;
  if (!proofStories.length) {
    return null;
  }

  const seams = buildMaintainedSeams(proofStories);
  const outputs = buildMaintainedOutputs({
    seams,
    proofStories,
    ownershipBoundary: ownershipBoundaryForMaintainedSurface(),
    verificationTargets,
    graph
  });
  const maintainedFiles = stableSortedStrings(proofStories.flatMap(/** @param {any} item */ (item) => item.maintainedFiles || []));
  const emittedDependencies = stableSortedStrings(proofStories.flatMap(/** @param {any} item */ (item) => item.emittedDependencies || []));
  const humanOwnedSeams = stableSortedStrings(proofStories.flatMap(/** @param {any} item */ (item) => item.humanOwnedSeams || []));

  return {
    type: "maintained_boundary",
    version: 2,
    summary: {
      focus: "Maintained-app files, emitted constraints, and explicit review boundaries",
      maintained_file_count: maintainedFiles.length,
      accepted_change_count: proofStories.filter(/** @param {any} item */ (item) => item.classification === "accepted_change").length,
      guarded_change_count: proofStories.filter(/** @param {any} item */ (item) => item.classification === "guarded_manual_decision").length,
      no_go_count: proofStories.filter(/** @param {any} item */ (item) => item.classification === "no_go").length
    },
    maintained_files_in_scope: maintainedFiles,
    emitted_artifact_dependencies: emittedDependencies,
    human_owned_seams: humanOwnedSeams,
    outputs,
    seams,
    proof_stories: proofStories.map(/** @param {any} item */ (item) => ({
      classification: item.classification,
      relativePath: item.relativePath,
      maintained_files: item.maintainedFiles || [],
      emitted_dependencies: item.emittedDependencies || [],
      human_owned_seams: item.humanOwnedSeams || [],
      seam_family_id: item.seamFamilyId || null,
      seam_family_label: item.seamFamilyLabel || null,
      review_boundary: item.reviewBoundary,
      ownership_boundary: item.ownership_boundary
    })),
    ownership_boundary: ownershipBoundaryForMaintainedSurface()
  };
}

/**
 * @param {string} workspaceRoot
 * @param {import("./types.d.ts").ContextGraph | null} graph
 * @returns {any}
 */
export function buildLocalMaintainedBoundaryArtifact(workspaceRoot, graph = null) {
  const proofStories = readLocalMaintainedProofMetadataFromWorkspace(path.resolve(workspaceRoot));
  if (!proofStories.length) {
    return null;
  }

  const emittedDependencies = stableSortedStrings(proofStories.flatMap(/** @param {any} item */ (item) => item.emittedDependencies || []));
  const verificationTargets = graph
    ? recommendedVerificationTargets(graph, emittedDependencies, {
        includeMaintainedApp: true,
        rationale: "Local maintained proof stories should point agents at emitted dependency checks plus any maintained proof gates."
      })
    : null;

  return buildMaintainedBoundaryArtifact({
    proofStories,
    verificationTargets,
    graph
  });
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function maintainedProofMetadata(graph) {
  const repoRoot = repoRootFromGraph(graph);
  const staticFiles = [
    {
      classification: "accepted_change",
      path: "examples/maintained/proof-app/proof/issues-ownership-visibility-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/issues.js"],
      emittedDependencies: ["proj_web", "proj_api", "journey_issue_resolution_and_closure"],
      humanOwnedSeams: ["maintained presenter structure", "detail/list rendering treatment"]
    },
    {
      classification: "accepted_change",
      path: "examples/maintained/proof-app/proof/issues-cross-surface-alignment-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/issues.js"],
      emittedDependencies: ["proj_web", "proj_api", "journey_issue_creation_and_assignment", "journey_issue_resolution_and_closure"],
      humanOwnedSeams: [
        "issues detail action state",
        "issues list/card summary state",
        "issues route and action metadata"
      ],
      seamFamilyId: "issues_cross_surface_alignment",
      seamFamilyLabel: "issues cross-surface ownership alignment"
    },
    {
      classification: "guarded_manual_decision",
      path: "examples/maintained/proof-app/proof/content-approval-workflow-decision-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/content-approval-change-guards.js"],
      emittedDependencies: ["cap_request_article_revision", "journey_editorial_review_and_revision"],
      humanOwnedSeams: ["new workflow affordance treatment", "action placement and copy"]
    },
    {
      classification: "no_go",
      path: "examples/maintained/proof-app/proof/issues-ownership-visibility-drift-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/issues.js"],
      emittedDependencies: ["proj_web", "journey_issue_resolution_and_closure"],
      humanOwnedSeams: ["owner visibility semantics must not drift"]
    },
    {
      classification: "no_go",
      path: "examples/maintained/proof-app/proof/content-approval-unsupported-change-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/content-approval.js", "examples/maintained/proof-app/src/content-approval-change-guards.js"],
      emittedDependencies: ["proj_web", "proj_api", "proj_db"],
      humanOwnedSeams: ["unsupported relation and workflow meaning changes"]
    },
    {
      classification: "no_go",
      path: "examples/maintained/proof-app/proof/todo-project-owner-unsupported-change-story.md",
      maintainedFiles: ["examples/maintained/proof-app/src/todo-change-guards.js"],
      emittedDependencies: ["entity_project", "proj_web", "proj_api"],
      humanOwnedSeams: ["ownership retargeting remains manual"]
    },
    {
      classification: "independent_review",
      path: "examples/maintained/proof-app/proof/maintained-contract-review.md",
      maintainedFiles: [
        "examples/maintained/proof-app/src/issues.js",
        "examples/maintained/proof-app/src/content-approval-change-guards.js",
        "examples/maintained/proof-app/src/todo-change-guards.js"
      ],
      emittedDependencies: ["maintained-proof-package"],
      humanOwnedSeams: ["human audit of emitted contracts vs maintained code"]
    },
    {
      classification: "accepted_change",
      path: "examples/generated/content-approval/implementation/proof/web-reference-seam-story.md",
      maintainedFiles: ["examples/generated/content-approval/implementation/web/reference.js"],
      emittedDependencies: ["proj_web", "journey_editorial_review_and_revision"],
      humanOwnedSeams: ["example web reference composition"]
    },
    {
      classification: "accepted_change",
      path: "examples/generated/content-approval/implementation/proof/backend-reference-seam-story.md",
      maintainedFiles: ["examples/generated/content-approval/implementation/backend/reference.js"],
      emittedDependencies: ["proj_api", "proj_db"],
      humanOwnedSeams: ["example backend reference integration"]
    }
  ];

  const staticProofs = staticFiles
    .map(/** @param {any} item */ (item) => {
      const absolutePath = path.join(repoRoot, item.path);
      return {
        ...item,
        exists: fs.existsSync(absolutePath),
        absolutePath,
        relativePath: item.path,
        reviewBoundary: reviewBoundaryForMaintainedClassification(item.classification),
        ownership_boundary: ownershipBoundaryForMaintainedSurface()
      };
    })
    .filter(/** @param {any} item */ (item) => item.exists);

  return [
    ...staticProofs,
    ...readLocalMaintainedProofMetadata(graph)
  ];
}

/**
 * @param {any} label
 * @returns {any}
 */
function maintainedSeamKind(label) {
  const normalized = String(label || "").toLowerCase();
  if (/audit|contract|review/.test(normalized)) {
    return "verification_harness";
  }
  if (/workflow|affordance|action|copy/.test(normalized)) {
    return "workflow_affordance";
  }
  if (/visibility|ownership|relation|policy/.test(normalized)) {
    return "policy_interpretation";
  }
  if (/route|navigation/.test(normalized)) {
    return "route_glue";
  }
  return "ui_presenter";
}

/**
 * @param {any} reviewBoundary
 * @returns {any}
 */
function maintainedSeamStatus(reviewBoundary) {
  const automationClass = reviewBoundary?.automation_class || "review_required";
  return automationClass === "safe" ? "aligned" : automationClass;
}

/**
 * @param {any} classification
 * @returns {any}
 */
function maintainedSeamOwnershipClass(classification) {
  if (classification === "accepted_change") {
    return "contract_bound";
  }
  if (classification === "guarded_manual_decision" || classification === "independent_review") {
    return "advisory_only";
  }
  if (classification === "no_go") {
    return "out_of_bounds";
  }
  return "contract_bound";
}

/**
 * @param {any} classification
 * @returns {any}
 */
function maintainedSeamAllowedChangeClasses(classification) {
  if (classification === "accepted_change") {
    return ["safe", "review_required"];
  }
  if (classification === "guarded_manual_decision") {
    return ["review_required", "manual_decision"];
  }
  if (classification === "independent_review") {
    return ["review_required"];
  }
  if (classification === "no_go") {
    return ["no_go"];
  }
  return ["review_required"];
}

/**
 * @param {any} emittedDependencies
 * @returns {any}
 */
function maintainedSeamDriftSignals(emittedDependencies = []) {
  const signals = new Set();
  for (const dependency of emittedDependencies || []) {
    if (dependency === "maintained-proof-package") {
      signals.add("verification_expectation_changed");
      continue;
    }
    if (dependency.startsWith("journey_") || dependency.startsWith("workflow_")) {
      signals.add("workflow_state_changed");
      continue;
    }
    if (dependency.startsWith("proj_ui") || dependency === "proj_web") {
      signals.add("emitted_contract_changed");
      signals.add("route_or_navigation_changed");
      continue;
    }
    if (
      dependency.startsWith("proj_") ||
      dependency.startsWith("cap_") ||
      dependency.startsWith("entity_") ||
      dependency.startsWith("shape_")
    ) {
      signals.add("emitted_contract_changed");
    }
  }
  return stableSortedStrings([...signals]);
}

/**
 * @param {any} filePaths
 * @returns {any}
 */
function maintainedOutputDescriptor(filePaths = []) {
  const files = stableSortedStrings(filePaths);
  if (files.some(/** @param {any} file */ (file) => String(file).startsWith("examples/maintained/proof-app/"))) {
    return {
      output_id: "maintained_app",
      label: "Maintained App",
      kind: "maintained_runtime",
      root_paths: ["examples/maintained/proof-app/**"]
    };
  }
  const exampleImplementationMatch = files
    .map(/** @param {any} file */ (file) => String(file).match(/^examples\/(?:(generated)\/)?([^/]+)\/implementation\/(web|backend|runtime)\//))
    .find(Boolean);
  if (exampleImplementationMatch) {
    const [, category, slug, outputKind] = exampleImplementationMatch;
    const outputId = `output_${seamIdHint(`examples_${slug}_${outputKind}`)}`;
    const rootPrefix = category ? `examples/${category}/${slug}` : `examples/${slug}`;
    const root = `${rootPrefix}/implementation/${outputKind}`;
    return {
      output_id: outputId,
      label: `${titleCaseWords(slug)} ${titleCaseWords(outputKind)} Reference`,
      kind: outputKind === "web" ? "web_app" : outputKind === "backend" ? "backend_adapter" : "maintained_runtime",
      root_paths: [`${root}/**`]
    };
  }
  if (files.some(/** @param {any} file */ (file) => String(file).startsWith("src/"))) {
    return {
      output_id: "output_src",
      label: "Source",
      kind: "backend_adapter",
      root_paths: ["src/**"]
    };
  }

  const firstFile = files[0] || "";
  const segments = String(firstFile).split("/").filter(Boolean);
  const root = segments.length >= 2 ? segments.slice(0, 2).join("/") : (segments[0] || "maintained");
  const outputStem = seamIdHint(root);
  return {
    output_id: `output_${outputStem}`,
    label: titleCaseWords(root.replaceAll("/", "_")),
    kind: "maintained_runtime",
    root_paths: [`${root}/**`]
  };
}

/**
 * @param {any} existing
 * @param {any} next
 * @returns {any}
 */
function mergeMaintainedSeam(existing, next) {
  if (!existing) {
    return {
      ...next,
      seam_family_id: next.seam_family_id || null,
      seam_family_label: next.seam_family_label || null,
      maintained_modules: stableSortedStrings(next.maintained_modules || []),
      emitted_dependencies: stableSortedStrings(next.emitted_dependencies || []),
      human_owned_aspects: stableSortedStrings(next.human_owned_aspects || []),
      allowed_change_classes: stableSortedStrings(next.allowed_change_classes || []),
      drift_signals: stableSortedStrings(next.drift_signals || []),
      proof_stories: [...(next.proof_stories || [])]
    };
  }

  const statusPriority = ["aligned", "review_required", "manual_decision", "no_go"];
  const ownershipPriority = ["engine_owned", "contract_bound", "advisory_only", "out_of_bounds"];

  const currentStatus = statusPriority.indexOf(existing.status);
  const nextStatus = statusPriority.indexOf(next.status);
  const currentOwnership = ownershipPriority.indexOf(existing.ownership_class);
  const nextOwnership = ownershipPriority.indexOf(next.ownership_class);

  return {
    ...existing,
    kind: existing.kind || next.kind,
    seam_family_id: existing.seam_family_id || next.seam_family_id || null,
    seam_family_label: existing.seam_family_label || next.seam_family_label || null,
    status: nextStatus > currentStatus ? next.status : existing.status,
    ownership_class: nextOwnership > currentOwnership ? next.ownership_class : existing.ownership_class,
    maintained_modules: stableSortedStrings([...(existing.maintained_modules || []), ...(next.maintained_modules || [])]),
    emitted_dependencies: stableSortedStrings([...(existing.emitted_dependencies || []), ...(next.emitted_dependencies || [])]),
    human_owned_aspects: stableSortedStrings([...(existing.human_owned_aspects || []), ...(next.human_owned_aspects || [])]),
    allowed_change_classes: stableSortedStrings([...(existing.allowed_change_classes || []), ...(next.allowed_change_classes || [])]),
    drift_signals: stableSortedStrings([...(existing.drift_signals || []), ...(next.drift_signals || [])]),
    proof_stories: stableSortedStrings([
      ...(existing.proof_stories || []).map(/** @param {any} item */ (item) => JSON.stringify(item)),
      ...(next.proof_stories || []).map(/** @param {any} item */ (item) => JSON.stringify(item))
    ]).map(/** @param {any} item */ (item) => JSON.parse(item))
  };
}

/**
 * @param {import("./types.d.ts").MaintainedProofStory[]} proofStories
 * @returns {any}
 */
export function buildMaintainedSeams(proofStories = []) {
  const seams = new Map();

  for (const story of proofStories || []) {
    for (const seamLabel of story.humanOwnedSeams || story.human_owned_seams || []) {
      const output = maintainedOutputDescriptor(story.maintainedFiles || story.maintained_files || []);
      const seam = {
        seam_id: `seam_${seamIdHint(seamLabel)}`,
        seam_family_id: story.seamFamilyId || story.seam_family_id || null,
        seam_family_label: story.seamFamilyLabel || story.seam_family_label || null,
        output_id: output.output_id,
        label: seamLabel,
        kind: maintainedSeamKind(seamLabel),
        ownership_class: maintainedSeamOwnershipClass(story.classification),
        status: maintainedSeamStatus(story.reviewBoundary || story.review_boundary),
        maintained_modules: story.maintainedFiles || story.maintained_files || [],
        emitted_dependencies: story.emittedDependencies || story.emitted_dependencies || [],
        human_owned_aspects: [seamLabel],
        allowed_change_classes: maintainedSeamAllowedChangeClasses(story.classification),
        drift_signals: maintainedSeamDriftSignals(story.emittedDependencies || story.emitted_dependencies || []),
        proof_stories: [
          {
            classification: story.classification || null,
            relativePath: story.relativePath || story.relative_path || null,
            review_boundary: story.reviewBoundary || story.review_boundary || null
          }
        ]
      };
      seams.set(seam.seam_id, mergeMaintainedSeam(seams.get(seam.seam_id), seam));
    }
  }

  return [...seams.values()].sort(/** @param {any} a @param {any} b */ (a, b) => a.seam_id.localeCompare(b.seam_id));
}

/**
 * @param {import("./types.d.ts").MaintainedBoundaryOptions} arg1
 * @returns {any}
 */
export function buildMaintainedOutputs(arg1 = {}) {
  const {
  seams = [],
  proofStories = [],
  ownershipBoundary = ownershipBoundaryForMaintainedSurface(),
  verificationTargets = null,
  graph = null
  } = arg1;
  const outputs = new Map();

  for (const seam of seams || []) {
    const descriptor = maintainedOutputDescriptor(seam.maintained_modules || []);
    const outputId = seam.output_id || descriptor.output_id;
    const existing = outputs.get(outputId) || /** @type {any} */ ({
      output_id: outputId,
      label: descriptor.label,
      kind: descriptor.kind,
      root_paths: descriptor.root_paths,
      ownership_boundary: ownershipBoundary,
      verification_targets: verificationTargets || null,
      maintained_files_in_scope: [],
      human_owned_seams: [],
      seams: [],
      proof_stories: []
    });

    existing.maintained_files_in_scope = stableSortedStrings([
      ...existing.maintained_files_in_scope,
      ...(seam.maintained_modules || [])
    ]);
    existing.human_owned_seams = stableSortedStrings([
      ...existing.human_owned_seams,
      seam.label
    ]);
    existing.seams.push({
      ...seam,
      output_id: outputId
    });
    outputs.set(outputId, existing);
  }

  for (const story of proofStories || []) {
    const descriptor = maintainedOutputDescriptor(story.maintainedFiles || story.maintained_files || []);
    const outputId = descriptor.output_id;
    const existing = outputs.get(outputId) || /** @type {any} */ ({
      output_id: outputId,
      label: descriptor.label,
      kind: descriptor.kind,
      root_paths: descriptor.root_paths,
      ownership_boundary: ownershipBoundary,
      verification_targets: verificationTargets || null,
      maintained_files_in_scope: [],
      human_owned_seams: [],
      seams: [],
      proof_stories: []
    });

    existing.maintained_files_in_scope = stableSortedStrings([
      ...existing.maintained_files_in_scope,
      ...(story.maintainedFiles || story.maintained_files || [])
    ]);
    existing.human_owned_seams = stableSortedStrings([
      ...existing.human_owned_seams,
      ...(story.humanOwnedSeams || story.human_owned_seams || [])
    ]);
    existing.proof_stories.push(story);
    outputs.set(outputId, existing);
  }

  const verificationTargetsForOutput = /** @param {import("./types.d.ts").MaintainedOutput} output @returns {any} */ (output) => {
    if (!graph) {
      return output.verification_targets || verificationTargets || null;
    }

    const emittedDependencies = stableSortedStrings([
      ...output.seams.flatMap(/** @param {import("./types.d.ts").MaintainedSeam} seam */ (seam) => seam.emitted_dependencies || []),
      ...output.proof_stories.flatMap(/** @param {any} story */ (story) => story.emittedDependencies || story.emitted_dependencies || [])
    ]);
    const verificationIds = stableSortedStrings(
      emittedDependencies.filter(/** @param {any} id */ (id) => String(id).startsWith("ver_"))
    );
    const generatedDependencyTargets = emittedDependencies.filter(/** @param {any} id */ (id) => !String(id).startsWith("ver_"));
    const targetIds = stableSortedStrings([...verificationIds, ...generatedDependencyTargets]);
    const includeMaintainedApp = output.kind === "maintained_runtime" || output.kind === "web_app" || output.kind === "mobile_app";

    const routedTargets = /** @type {any} */ (recommendedVerificationTargets(graph, targetIds, {
      includeMaintainedApp,
      rationale: `${output.label || output.output_id || "Maintained output"} should run the smallest verification set tied to its own emitted dependencies and maintained seams.`
    }));

    return {
      ...routedTargets,
      verification_ids: stableSortedStrings([
        ...(routedTargets.verification_ids || []),
        ...(verificationTargets?.verification_ids || []).filter(/** @param {any} id */ (id) => verificationIds.includes(id))
      ]),
      generated_checks: stableSortedStrings([
        ...(routedTargets.generated_checks || []),
        ...(verificationTargets?.generated_checks || []).filter(/** @param {any} check */ (check) => routedTargets.generated_checks?.includes(check))
      ]),
      maintained_app_checks: includeMaintainedApp
        ? stableSortedStrings([
            ...(routedTargets.maintained_app_checks || []),
            ...(verificationTargets?.maintained_app_checks || [])
          ])
        : []
    };
  };

  return [...outputs.values()]
    .map(/** @param {import("./types.d.ts").MaintainedOutput} output */ (output) => ({
      ...output,
      verification_targets: verificationTargetsForOutput(output),
      write_scope: graph ? buildMaintainedWriteScope(graph, output.maintained_files_in_scope) : null,
      seams: [...output.seams].sort(/** @param {any} a @param {any} b */ (a, b) => String(a.seam_id || "").localeCompare(String(b.seam_id || ""))),
      proof_stories: [...output.proof_stories]
    }))
    .sort(/** @param {any} a @param {any} b */ (a, b) => a.output_id.localeCompare(b.output_id));
}
