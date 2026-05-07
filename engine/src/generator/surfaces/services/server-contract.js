import { generateApiContractGraph } from "../../api.js";
import { getProjection } from "../shared.js";
import { toPascalCase } from "../databases/shared.js";

function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

function apiProjectionCandidates(graph) {
  return (graph.byKind.projection || []).filter((projection) => (projection.http || projection.endpoints || []).length > 0);
}

function repositoryMethodName(capabilityId) {
  const base = capabilityId.replace(/^cap_/, "");
  return base.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function buildServerContract(graph, projection) {
  const byId = indexStatements(graph);
  const realizedCapabilities = (projection.realizes || [])
    .map((ref) => byId.get(ref.id))
    .filter((statement) => statement?.kind === "capability");

  return {
    type: "server_contract_graph",
    projection: {
      id: projection.id,
      name: projection.name || projection.id,
      type: projection.type || projection.type
    },
    routes: realizedCapabilities.map((capability) => {
      const apiContract = generateApiContractGraph(graph, { capabilityId: capability.id });
      return {
        capabilityId: capability.id,
        handlerName: `handle${toPascalCase(capability.id.replace(/^cap_/, ""))}`,
        repositoryMethod: repositoryMethodName(capability.id),
        method: apiContract.endpoint.method,
        path: apiContract.endpoint.path,
        successStatus: apiContract.endpoint.successStatus,
        requestContract: apiContract.requestContract,
        responseContract: apiContract.responseContract || null,
        errors: apiContract.errors,
        endpoint: {
          auth: apiContract.endpoint.auth,
          authz: apiContract.endpoint.authz || [],
          preconditions: apiContract.endpoint.preconditions || [],
          idempotency: apiContract.endpoint.idempotency || [],
          cache: apiContract.endpoint.cache || [],
          asyncJobs: apiContract.endpoint.async || [],
          asyncStatus: apiContract.endpoint.status || [],
          download: apiContract.endpoint.download || []
        }
      };
    })
  };
}

function renderServerContractsTs(contract) {
  return `export const serverContract = ${JSON.stringify(contract, null, 2)} as const;\n`;
}

export function generateServerContract(graph, options = {}) {
  if (options.projectionId) {
    return buildServerContract(graph, getProjection(graph, options.projectionId));
  }

  const output = {};
  for (const projection of apiProjectionCandidates(graph)) {
    output[projection.id] = buildServerContract(graph, projection);
  }
  return output;
}

export function renderServerContractModule(graph, projectionId) {
  return renderServerContractsTs(buildServerContract(graph, getProjection(graph, projectionId)));
}
