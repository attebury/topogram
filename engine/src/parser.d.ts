import type { TopogramDoc } from "./workspace-docs.js";

export interface ParserPosition {
  line: number;
  column: number;
  offset: number;
}

export interface LexerToken {
  type: string;
  value: string;
  start: ParserPosition;
  end: ParserPosition;
}

export interface AstLocation {
  file: string;
  start: ParserPosition;
  end: ParserPosition;
}

export interface AstScalar {
  type: "string" | "symbol";
  value: string;
  loc: AstLocation;
}

export interface AstList {
  type: "list";
  items: AstValue[];
  loc: AstLocation;
}

export interface AstSequence {
  type: "sequence";
  items: AstValue[];
  loc: AstLocation;
}

export interface AstBlock {
  type: "block";
  entries: AstBlockEntry[];
  loc: AstLocation;
}

export type AstValue = AstScalar | AstList | AstSequence | AstBlock;

export interface AstBlockEntry {
  type: "block_entry";
  items: AstValue[];
  loc: AstLocation;
}

export interface AstField {
  type: "field";
  key: string;
  value: AstValue;
  loc: AstLocation;
}

export interface AstStatement {
  type: "statement";
  kind: string;
  id: string;
  from: AstScalar | null;
  fields: AstField[];
  loc: AstLocation;
}

export interface AstDocument {
  type: "document";
  file: string;
  statements: AstStatement[];
}

export interface WorkspaceAst {
  type: "workspace";
  root: string;
  files: AstDocument[];
  docs: TopogramDoc[];
}

export function lex(source: string, filePath?: string): LexerToken[];
export function parseSource(source: string, filePath?: string): AstDocument;
export function parseFile(filePath: string): AstDocument;
export function collectTopogramFiles(inputPath: string): string[];
export function parsePath(root: string): WorkspaceAst;
