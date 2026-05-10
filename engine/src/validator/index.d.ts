import type {
  TopogramBlockEntry,
  TopogramField,
  TopogramFieldMap,
  TopogramRegistry,
  TopogramStatement,
  TopogramToken,
  ValidationErrors
} from "../topogram-types.js";

export function pushError(errors: ValidationErrors, message: string, loc?: any): void;
export function formatLoc(loc: any): string;
export function valueAsArray(value: TopogramToken | null | undefined): TopogramToken[];
export function symbolValues(value: TopogramToken | null | undefined): string[];
export function collectFieldMap(statement: TopogramStatement): TopogramFieldMap;
export function getField(statement: TopogramStatement, key: string): TopogramField | null;
export function getFieldValue(statement: TopogramStatement, key: string): TopogramToken | null;
export function stringValue(value: TopogramToken | null | undefined): string | null;
export function symbolValue(value: TopogramToken | null | undefined): string | null;
export function blockEntries(value: TopogramToken | null | undefined): TopogramBlockEntry[];
export function buildRegistry(workspaceAst: any, errors: ValidationErrors): TopogramRegistry;
export function validateWorkspace(workspaceAst: any): any;
export function formatValidationErrors(result: any): string;
