import { generateApiContractGraph } from "../../api.js";
import { findEnumStatement, toPascalCase } from "../databases/shared.js";
import { getProjection } from "../shared.js";
import { repositoryMethodName } from "./runtime-helpers.js";
import { getExampleImplementation } from "../../../example-implementation.js";

function indexStatements(graph) {
  const byId = new Map();
  for (const statement of graph.statements) {
    byId.set(statement.id, statement);
  }
  return byId;
}

function repositoryOperations(graph, repositoryReference) {
  const byId = indexStatements(graph);
  const capabilityIds = repositoryReference.capabilityIds;

  return capabilityIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((capability) => ({
      capability,
      input: capability.input[0] ? byId.get(capability.input[0].id) : null,
      output: capability.output[0] ? byId.get(capability.output[0].id) : null
    }));
}

function tsTypeForField(field, byId) {
  const enumStatement = findEnumStatement(byId, field.fieldType);
  if (enumStatement) {
    return enumStatement.values.map((value) => `"${value}"`).join(" | ");
  }
  switch (field.fieldType) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

function renderShapeType(name, shape, byId) {
  if (!shape) {
    return `export type ${name} = Record<string, unknown>;\n`;
  }
  const fields = shape.projectedFields || shape.fields || [];
  const lines = [`export interface ${name} {`];
  for (const field of fields) {
    lines.push(`  ${field.name}${field.requiredness === "required" ? "" : "?"}: ${tsTypeForField(field, byId)};`);
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function renderResponseTypeDeclarations(baseName, contract, byId) {
  if (!contract) {
    return [`export type ${baseName} = Record<string, unknown>;\n`];
  }

  if (contract.mode === "item") {
    const fields = contract.fields || [];
    const lines = [`export interface ${baseName} {`];
    for (const field of fields) {
      const shapeField = {
        fieldType:
          field.schema?.["x-topogram-type"] || field.schema?.format === "uuid"
            ? field.schema.format === "uuid"
              ? "uuid"
              : field.schema["x-topogram-type"]
            : field.schema?.format === "date-time"
              ? "datetime"
              : field.schema?.type === "integer"
                ? "integer"
                : field.schema?.type === "number"
                  ? "number"
                  : field.schema?.type === "boolean"
                    ? "boolean"
                    : field.schema?.enum
                      ? field.schema.enum.map((value) => `"${value}"`).join(" | ")
                      : "text",
        name: field.name,
        requiredness: field.required ? "required" : "optional"
      };
      const type = field.schema?.enum
        ? field.schema.enum.map((value) => `"${value}"`).join(" | ")
        : tsTypeForField(shapeField, byId);
      lines.push(`  ${field.name}${field.required ? "" : "?"}: ${type};`);
    }
    lines.push("}");
    return [`${lines.join("\n")}\n`];
  }

  const itemName = `${baseName}Item`;
  const itemFields = contract.fields || [];
  const itemLines = [`export interface ${itemName} {`];
  for (const field of itemFields) {
    const shapeField = {
      fieldType: field.schema?.format === "uuid"
        ? "uuid"
        : field.schema?.format === "date-time"
          ? "datetime"
          : field.schema?.type === "integer"
            ? "integer"
            : field.schema?.type === "number"
              ? "number"
              : field.schema?.type === "boolean"
                ? "boolean"
                : field.schema?.enum
                  ? field.schema.enum.map((value) => `"${value}"`).join(" | ")
                  : "text",
      name: field.name,
      requiredness: field.required ? "required" : "optional"
    };
    const type = field.schema?.enum
      ? field.schema.enum.map((value) => `"${value}"`).join(" | ")
      : tsTypeForField(shapeField, byId);
    itemLines.push(`  ${field.name}${field.required ? "" : "?"}: ${type};`);
  }
  itemLines.push("}");

  const envelopeLines = [`export interface ${baseName} {`];
  if (contract.mode === "collection") {
    envelopeLines.push(`  items: ${itemName}[];`);
  }
  if (contract.mode === "paged") {
    envelopeLines.push(`  items: ${itemName}[];`);
    envelopeLines.push("  page: number;");
    envelopeLines.push("  page_size: number;");
    envelopeLines.push("  total: number;");
  }
  if (contract.mode === "cursor") {
    envelopeLines.push(`  items: ${itemName}[];`);
    envelopeLines.push(`  ${contract.cursor?.responseNext || "next_cursor"}: string;`);
    if (contract.cursor?.responsePrev) {
      envelopeLines.push(`  ${contract.cursor.responsePrev}?: string;`);
    }
    if (contract.total?.included) {
      envelopeLines.push("  total?: number;");
    }
  }
  envelopeLines.push("}");

  return [`${itemLines.join("\n")}\n`, `${envelopeLines.join("\n")}\n`];
}

export function generatePersistenceScaffold(graph, options = {}) {
  const implementation = getExampleImplementation(graph, options);
  const repositoryReference = implementation.backend.repositoryReference;
  const repositoryRenderers = implementation.backend.repositoryRenderers;
  const repositoryInterfaceName = repositoryReference.repositoryInterfaceName;
  const prismaRepositoryClassName = repositoryReference.prismaRepositoryClassName;
  const drizzleRepositoryClassName = repositoryReference.drizzleRepositoryClassName;
  const drizzleHint = repositoryReference.drizzleHint;
  const projection = getProjection(graph, options.projectionId);
  const projectionType = projection.type || projection.type;
  if (projectionType !== "db_contract") {
    throw new Error(`Persistence scaffold generation currently supports db_contract projections only, found '${projectionType}'`);
  }

  const byId = indexStatements(graph);
  const operations = repositoryOperations(graph, repositoryReference);
  const interfaceLines = [];
  const prismaLines = [];
  const drizzleLines = [];
  const typeLines = [];

  prismaLines.push('import { PrismaClient } from "@prisma/client";');
  prismaLines.push(`import type { ${repositoryInterfaceName} } from "../repositories";`);
  prismaLines.push('import type {');
  drizzleLines.push('import type { NodePgDatabase } from "drizzle-orm/node-postgres";');
  drizzleLines.push(`import type { ${repositoryInterfaceName} } from "../repositories";`);
  drizzleLines.push(`import { ${repositoryReference.drizzleSchemaImports.join(", ")} } from "../schema";`);
  drizzleLines.push('import type {');

  const usedTypes = new Set();
  for (const operation of operations) {
    const apiContract = generateApiContractGraph(graph, { capabilityId: operation.capability.id });
    const method = repositoryMethodName(operation.capability.id);
    const inputType = `${toPascalCase(method)}Input`;
    const outputType = `${toPascalCase(method)}Result`;
    usedTypes.add(inputType);
    usedTypes.add(outputType);
    prismaLines.push(`  ${inputType},`);
    prismaLines.push(`  ${outputType},`);
    drizzleLines.push(`  ${inputType},`);
    drizzleLines.push(`  ${outputType},`);
    typeLines.push(renderShapeType(inputType, operation.input, byId));
    typeLines.push(...renderResponseTypeDeclarations(outputType, apiContract.responseContract, byId));
  }
  for (const declaration of repositoryReference.additionalTypeDeclarations || []) {
    typeLines.push(`${declaration.trimEnd()}\n`);
  }
  for (const typeName of repositoryReference.additionalTypeNames || []) {
    usedTypes.add(typeName);
    prismaLines.push(`  ${typeName},`);
    drizzleLines.push(`  ${typeName},`);
  }
  interfaceLines.push('import type {');
  for (const typeName of [...usedTypes].sort()) {
    interfaceLines.push(`  ${typeName},`);
  }
  interfaceLines.push('} from "./types";');
  interfaceLines.push("");
  interfaceLines.push(`export interface ${repositoryInterfaceName} {`);
  for (const operation of operations) {
    const method = repositoryMethodName(operation.capability.id);
    const inputType = `${toPascalCase(method)}Input`;
    const outputType = `${toPascalCase(method)}Result`;
    interfaceLines.push(`  ${method}(input: ${inputType}): Promise<${outputType}>;`);
  }
  for (const method of repositoryReference.additionalInterfaceMethods || []) {
    interfaceLines.push(`  ${method}`);
  }
  interfaceLines.push("}");
  prismaLines.push('} from "../types";');
  drizzleLines.push('} from "../types";');
  prismaLines.push("");
  prismaLines.push('import { HttpError } from "../../server/helpers";');
  drizzleLines.push("");
  prismaLines.push(repositoryRenderers.renderPrismaRepositoryBody({
    repositoryInterfaceName,
    prismaRepositoryClassName,
    repositoryReference
  }).trimEnd());
  drizzleLines.push(repositoryRenderers.renderDrizzleRepositoryBody({
    repositoryInterfaceName,
    drizzleRepositoryClassName,
    repositoryReference,
    drizzleHint
  }).trimEnd());

  return {
    "types.ts": `${typeLines.join("\n").trimEnd()}\n`,
    "repositories.ts": `${interfaceLines.join("\n").trimEnd()}\n`,
    "prisma/repositories.ts": `${prismaLines.join("\n").trimEnd()}\n`,
    "drizzle/repositories.ts": `${drizzleLines.join("\n").trimEnd()}\n`
  };
}
