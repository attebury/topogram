import type { TopogramLocation } from "./topogram-types.js";

export const DOC_KINDS: Set<string>;
export const DOC_STATUSES: Set<string>;
export const DOC_CONFIDENCE: Set<string>;
export const DOC_AUDIENCES: Set<string>;
export const DOC_PRIORITIES: Set<string>;
export const DOC_ARRAY_FIELDS: Set<string>;
export const DOC_REFERENCE_FIELDS: Record<string, string>;
export const DOC_SCALAR_FIELDS: Set<string>;

export interface TopogramDocParseError {
  message: string;
  loc: TopogramLocation;
}

export interface TopogramDoc {
  type: "doc";
  file: string;
  relativePath: string;
  metadata: Record<string, any>;
  body: string;
  loc: TopogramLocation;
  parseError: TopogramDocParseError | null;
}

export function collectTopogramDocFiles(inputPath: string): string[];
export function parseDocFile(filePath: string, workspaceRoot: string): TopogramDoc;
export function parseDocsPath(inputPath: string): TopogramDoc[];
