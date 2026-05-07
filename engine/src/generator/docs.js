import { fieldSignature, refList, symbolList } from "./shared.js";

function invariantSummary(invariant) {
  switch (invariant.type) {
    case "comparison":
      return `\`${invariant.left} ${invariant.operator} ${invariant.right?.value}\``;
    case "requires":
      return `\`${invariant.field}\` requires \`${invariant.predicate?.left} ${invariant.predicate?.operator} ${invariant.predicate?.right?.value}\``;
    case "length_check":
      return `\`${invariant.field}\` length ${invariant.operator} ${invariant.value?.value}`;
    case "format_check":
      return `\`${invariant.field}\` format ${invariant.operator} \`${invariant.format}\``;
    case "implication":
      if (invariant.then?.type === "state_check") {
        return `if \`${invariant.when?.left} ${invariant.when?.operator} ${invariant.when?.right?.value}\`, then \`${invariant.then.field} is ${invariant.then.value?.value}\``;
      }
      return `if \`${invariant.when?.left} ${invariant.when?.operator} ${invariant.when?.right?.value}\`, then \`${invariant.then?.left} ${invariant.then?.operator} ${invariant.then?.right?.value}\``;
    default:
      return invariant.raw ? `\`${invariant.raw.join(" ")}\`` : "`unknown invariant`";
  }
}

function relationSummary(relation) {
  if (relation.type === "reference" && relation.target) {
    return `\`${relation.sourceField}\` references \`${relation.target.id}.${relation.target.field}\``;
  }

  return relation.raw.map((value) => (Array.isArray(value) ? `[${value.join(", ")}]` : `\`${value}\``)).join(" ");
}

export function generateDocs(graph) {
  const decisions = graph.byKind.decision || [];
  const enums = graph.byKind.enum || [];
  const actors = graph.byKind.actor || [];
  const roles = graph.byKind.role || [];
  const entities = graph.byKind.entity || [];
  const shapes = graph.byKind.shape || [];
  const capabilities = graph.byKind.capability || [];
  const rules = graph.byKind.rule || [];
  const projections = graph.byKind.projection || [];
  const verifications = graph.byKind.verification || [];
  const operations = graph.byKind.operation || [];

  const lines = [];
  lines.push("# Topogram Domain");
  lines.push("");
  lines.push(`Generated from \`${graph.root}\``);
  lines.push("");

  lines.push("## Enums");
  lines.push("");
  for (const item of enums) {
    lines.push(`### \`${item.id}\``);
    lines.push("");
    lines.push(`Values: ${symbolList(item.values)}`);
    lines.push("");
  }

  if (actors.length > 0) {
    lines.push("## Actors");
    lines.push("");
    for (const actor of actors) {
      lines.push(`### \`${actor.id}\` - ${actor.name || actor.id}`);
      lines.push("");
      if (actor.description) {
        lines.push(actor.description);
        lines.push("");
      }
      lines.push(`Status: \`${actor.status}\``);
      lines.push("");
    }
  }

  if (roles.length > 0) {
    lines.push("## Roles");
    lines.push("");
    for (const role of roles) {
      lines.push(`### \`${role.id}\` - ${role.name || role.id}`);
      lines.push("");
      if (role.description) {
        lines.push(role.description);
        lines.push("");
      }
      lines.push(`Status: \`${role.status}\``);
      lines.push("");
    }
  }

  if (decisions.length > 0) {
    lines.push("## Decisions");
    lines.push("");
    for (const decision of decisions) {
      lines.push(`### \`${decision.id}\` - ${decision.name || decision.id}`);
      lines.push("");
      if (decision.description) {
        lines.push(decision.description);
        lines.push("");
      }
      lines.push(`Context: ${symbolList(decision.context)}`);
      lines.push(`Consequences: ${symbolList(decision.consequences)}`);
      lines.push(`Status: \`${decision.status}\``);
      lines.push("");
    }
  }

  lines.push("## Entities");
  lines.push("");
  for (const entity of entities) {
    lines.push(`### \`${entity.id}\` - ${entity.name || entity.id}`);
    lines.push("");
    if (entity.description) {
      lines.push(entity.description);
      lines.push("");
    }
    lines.push("Fields:");
    for (const field of entity.fields) {
      lines.push(`- ${fieldSignature(field)}`);
    }
    if (entity.relations.length > 0) {
      lines.push("");
      lines.push("Relations:");
      for (const relation of entity.relations) {
        lines.push(`- ${relationSummary(relation)}`);
      }
    }
    if (entity.invariants.length > 0) {
      lines.push("");
      lines.push("Invariants:");
      for (const invariant of entity.invariants) {
        lines.push(`- ${invariantSummary(invariant)}`);
      }
    }
    lines.push("");
  }

  lines.push("## Shapes");
  lines.push("");
  for (const shape of shapes) {
    lines.push(`### \`${shape.id}\` - ${shape.name || shape.id}`);
    lines.push("");
    if (shape.description) {
      lines.push(shape.description);
      lines.push("");
    }
    if (shape.from?.id) {
      lines.push(`Derived from: \`${shape.from.id}\``);
      lines.push("");
    }
    if (shape.transformGraph?.transforms?.length > 0) {
      lines.push("Transforms:");
      for (const transform of shape.transformGraph.transforms) {
        if (transform.type === "rename_field") {
          lines.push(`- rename \`${transform.from}\` -> \`${transform.to}\``);
          continue;
        }
        if (transform.type === "override_field") {
          const changes = [];
          if (transform.changes.requiredness) {
            changes.push(transform.changes.requiredness);
          }
          if (transform.changes.fieldType) {
            changes.push(`type \`${transform.changes.fieldType}\``);
          }
          if (transform.changes.defaultValue != null) {
            changes.push(`default \`${transform.changes.defaultValue}\``);
          }
          lines.push(`- override \`${transform.field}\`: ${changes.join(", ")}`);
        }
      }
      lines.push("");
    }
    lines.push("Projected fields:");
    for (const field of shape.projectedFields || shape.fields) {
      lines.push(`- ${fieldSignature(field)}`);
    }
    lines.push("");
  }

  lines.push("## Capabilities");
  lines.push("");
  for (const capability of capabilities) {
    lines.push(`### \`${capability.id}\` - ${capability.name || capability.id}`);
    lines.push("");
    if (capability.description) {
      lines.push(capability.description);
      lines.push("");
    }
    lines.push(`Actors: ${refList(capability.actors)}`);
    lines.push(`Roles: ${refList(capability.roles)}`);
    lines.push(`Reads: ${refList(capability.reads)}`);
    lines.push(`Creates: ${refList(capability.creates)}`);
    lines.push(`Updates: ${refList(capability.updates)}`);
    lines.push(`Deletes: ${refList(capability.deletes)}`);
    lines.push(`Input: ${refList(capability.input)}`);
    lines.push(`Output: ${refList(capability.output)}`);
    lines.push("");
  }

  if (rules.length > 0) {
    lines.push("## Rules");
    lines.push("");
    for (const rule of rules) {
      lines.push(`### \`${rule.id}\` - ${rule.name || rule.id}`);
      lines.push("");
      if (rule.description) {
        lines.push(rule.description);
        lines.push("");
      }
      lines.push(`Applies to: ${refList(rule.appliesTo)}`);
      lines.push(`Actors: ${refList(rule.actors)}`);
      lines.push(`Roles: ${refList(rule.roles)}`);
      if (rule.requirementNode?.raw) {
        lines.push(`Requirement: \`${rule.requirementNode.raw}\``);
      }
      if (rule.conditionNode?.raw) {
        lines.push(`Condition: \`${rule.conditionNode.raw}\``);
      }
      lines.push(`Severity: \`${rule.severity}\``);
      lines.push("");
    }
  }

  lines.push("## Projections");
  lines.push("");
  for (const projection of projections) {
    lines.push(`### \`${projection.id}\` - ${projection.name || projection.id}`);
    lines.push("");
    if (projection.description) {
      lines.push(projection.description);
      lines.push("");
    }
    lines.push(`Projection type: \`${projection.type}\``);
    lines.push(`Realizes: ${refList(projection.realizes)}`);
    lines.push(`Outputs: ${symbolList(projection.outputs)}`);
    lines.push("");
  }

  if (verifications.length > 0) {
    lines.push("## Verification");
    lines.push("");
    for (const verification of verifications) {
      lines.push(`### \`${verification.id}\` - ${verification.name || verification.id}`);
      lines.push("");
      if (verification.description) {
        lines.push(verification.description);
        lines.push("");
      }
      lines.push(`Method: \`${verification.method}\``);
      lines.push(`Validates: ${refList(verification.validates)}`);
      lines.push(`Scenarios: ${symbolList(verification.scenarios)}`);
      lines.push("");
    }
  }

  if (operations.length > 0) {
    lines.push("## Operations");
    lines.push("");
    for (const operation of operations) {
      lines.push(`### \`${operation.id}\` - ${operation.name || operation.id}`);
      lines.push("");
      if (operation.description) {
        lines.push(operation.description);
        lines.push("");
      }
      lines.push(`Observes: ${refList(operation.observes)}`);
      lines.push(`Metrics: ${symbolList(operation.metrics)}`);
      lines.push(`Alerts: ${symbolList(operation.alerts)}`);
      lines.push("");
    }
  }

  if ((graph.docs || []).length > 0) {
    lines.push("## Companion Docs");
    lines.push("");
    for (const doc of graph.docs) {
      lines.push(`### \`${doc.id}\` - ${doc.title}`);
      lines.push("");
      lines.push(`Kind: \`${doc.kind}\``);
      lines.push(`Status: \`${doc.status}\``);
      if (doc.summary) {
        lines.push("");
        lines.push(doc.summary);
      }
      if (doc.relatedEntities.length > 0) {
        lines.push("");
        lines.push(`Related entities: ${doc.relatedEntities.map((id) => `\`${id}\``).join(", ")}`);
      }
      if (doc.relatedCapabilities.length > 0) {
        lines.push(`Related capabilities: ${doc.relatedCapabilities.map((id) => `\`${id}\``).join(", ")}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function generateDocsIndex(graph) {
  const docs = (graph.docs || []).map((doc) => ({
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    status: doc.status,
    summary: doc.summary,
    aliases: doc.aliases,
    related_entities: doc.relatedEntities,
    related_capabilities: doc.relatedCapabilities,
    related_shapes: doc.relatedShapes,
    related_projections: doc.relatedProjections,
    related_docs: doc.relatedDocs,
    source_of_truth: doc.sourceOfTruth,
    confidence: doc.confidence,
    review_required: doc.reviewRequired,
    provenance: doc.provenance,
    tags: doc.tags,
    file: doc.file,
    relative_path: doc.relativePath,
    body: doc.body
  }));

  return {
    type: "docs_index",
    root: graph.root,
    count: docs.length,
    docs
  };
}
