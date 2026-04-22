import { buildDbRealization } from "../db/index.js";
import { generateServerContract } from "../../generator/apps/backend/server-contract.js";
import { dbProjectionCandidates } from "../../generator/db/shared.js";
import { getExampleImplementation } from "../../example-implementation.js";

function uiLookupBindings(graph) {
  const bindings = [];
  for (const projection of graph.byKind.projection || []) {
    for (const entry of projection.uiLookups || []) {
      if (entry.entity?.id) {
        bindings.push(entry);
      }
    }
  }
  return bindings;
}

export function getDefaultBackendDbProjection(graph, options = {}) {
  const candidates = dbProjectionCandidates(graph);
  const implementation = getExampleImplementation(graph);
  const preferredProjectionId = implementation.runtime?.reference?.localDbProjectionId || null;
  const explicit = options.dbProjectionId
    ? candidates.find((projection) => projection.id === options.dbProjectionId)
    : null;
  const preferred = preferredProjectionId
    ? candidates.find((projection) => projection.id === preferredProjectionId)
    : null;
  return (
    explicit ||
    preferred ||
    candidates.find((projection) => projection.platform === "db_postgres") ||
    candidates.find((projection) => projection.platform === "db_sqlite") ||
    candidates[0] ||
    null
  );
}

export function buildBackendRuntimeRealization(graph, options = {}) {
  if (!options.projectionId) {
    throw new Error("Backend runtime realization requires --projection <id>");
  }

  const dbProjection = getDefaultBackendDbProjection(graph, options);
  if (!dbProjection) {
    throw new Error("Backend runtime realization requires at least one DB projection");
  }

  const implementation = getExampleImplementation(graph);
  const repositoryReference = implementation.backend.repositoryReference;
  const backendReference = implementation.backend.reference;
  const contract = generateServerContract(graph, { projectionId: options.projectionId });
  const db = buildDbRealization(graph, { projectionId: dbProjection.id });
  const lookupRoutes = Array.from(
    new Map(
      uiLookupBindings(graph).map((entry) => [
        entry.entity.id,
        repositoryReference.lookupBindings.find((binding) => binding.entityId === entry.entity.id)
      ])
    ).values()
  ).filter((entry) => entry.repositoryMethod);

  return {
    type: "backend_runtime_realization",
    app: {
      id: options.projectionId,
      family: "backend",
      target: "hono",
      name: contract.projection.name
    },
    contract,
    db,
    lookupRoutes,
    backendReference,
    repositoryReference,
    dbProjection: {
      id: dbProjection.id,
      platform: dbProjection.platform
    }
  };
}
