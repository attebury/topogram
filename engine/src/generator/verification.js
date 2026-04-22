import { refList } from "./shared.js";

function normalizeScenarioLabel(scenario) {
  return String(scenario || "")
    .replace(/^verify_/, "")
    .replaceAll("_", " ")
    .trim();
}

function normalizeScenario(scenario, order) {
  const id = typeof scenario === "string" ? scenario : scenario?.value || `scenario_${order + 1}`;
  return {
    order,
    id,
    label: normalizeScenarioLabel(id)
  };
}

function normalizeVerification(verification) {
  return {
    id: verification.id,
    name: verification.name || verification.id,
    description: verification.description || "",
    method: verification.method,
    status: verification.status,
    validates: (verification.validates || []).map((item) => ({
      id: item.id,
      kind: item.kind
    })),
    scenarios: (verification.scenarios || []).map((scenario, index) => normalizeScenario(scenario, index))
  };
}

export function generateVerificationPlan(graph) {
  const verifications = (graph.byKind.verification || [])
    .map(normalizeVerification)
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    type: "verification_plan_bundle",
    name: "Topogram Verification Plan",
    root: graph.root,
    summary: {
      verificationCount: verifications.length,
      methods: [...new Set(verifications.map((entry) => entry.method))].sort(),
      scenarioCount: verifications.reduce((total, entry) => total + entry.scenarios.length, 0)
    },
    verifications
  };
}

export function generateVerificationChecklist(graph) {
  const verifications = (graph.byKind.verification || []).sort((left, right) => left.id.localeCompare(right.id));
  const lines = [];
  lines.push("# Verification Checklist");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  if (verifications.length === 0) {
    lines.push("No canonical verification entries are defined.");
    lines.push("");
    return `${lines.join("\n")}`;
  }

  for (const verification of verifications) {
    lines.push(`## \`${verification.id}\` - ${verification.name || verification.id}`);
    lines.push("");
    if (verification.description) {
      lines.push(verification.description);
      lines.push("");
    }
    lines.push(`Method: \`${verification.method}\``);
    lines.push(`Status: \`${verification.status}\``);
    lines.push(`Validates: ${refList(verification.validates)}`);
    lines.push("");
    for (const scenario of verification.scenarios || []) {
      lines.push(`- [ ] ${normalizeScenarioLabel(scenario)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
