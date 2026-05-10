import type {
  TopogramBlockEntry,
  TopogramField,
  TopogramFieldMap,
  TopogramStatement,
  TopogramToken,
  ValidationErrors
} from "../topogram-types.js";

export function blockEntries(value: TopogramToken | null | undefined): TopogramBlockEntry[];
export function collectFieldMap(statement: TopogramStatement): TopogramFieldMap;
export function formatLoc(loc: any): string;
export function getField(statement: TopogramStatement, key: string): TopogramField | undefined;
export function getFieldValue(statement: TopogramStatement, key: string): TopogramToken | null;
export function pushError(errors: ValidationErrors, message: string, loc?: any): void;
export function stringValue(value: TopogramToken | null | undefined): string | null;
export function symbolValue(value: TopogramToken | null | undefined): any;
export function symbolValues(value: TopogramToken | null | undefined): any[];
export function valueAsArray(value: TopogramToken | null | undefined): TopogramToken[];
