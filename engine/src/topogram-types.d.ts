export interface TopogramLocation {
  file?: string;
  start?: {
    line?: number;
    column?: number;
    offset?: number;
  };
  end?: {
    line?: number;
    column?: number;
    offset?: number;
  };
}

export interface TopogramToken {
  type: string;
  value: any;
  items: TopogramToken[];
  entries: TopogramBlockEntry[];
  loc: TopogramLocation;
  [key: string]: any;
}

export interface TopogramBlockEntry {
  items: TopogramToken[];
  loc: TopogramLocation;
  [key: string]: any;
}

export interface TopogramField {
  key: string;
  value: TopogramToken;
  loc: TopogramLocation;
  [key: string]: any;
}

export interface TopogramStatement {
  id: string;
  kind: string;
  fields: TopogramField[];
  loc: TopogramLocation;
  [key: string]: any;
}

export interface ValidationError {
  message: string;
  loc?: TopogramLocation | null;
}

export type ValidationErrors = ValidationError[];

export type TopogramFieldMap = Map<string, TopogramField[]>;

export type TopogramRegistry = Map<string, TopogramStatement>;

export type ResolverBacklinkIndex = Record<string, Map<string, string[]>>;

declare global {
  type TopogramLocation = import("./topogram-types.js").TopogramLocation;
  type TopogramToken = import("./topogram-types.js").TopogramToken;
  type TopogramBlockEntry = import("./topogram-types.js").TopogramBlockEntry;
  type TopogramField = import("./topogram-types.js").TopogramField;
  type TopogramStatement = import("./topogram-types.js").TopogramStatement;
  type ValidationError = import("./topogram-types.js").ValidationError;
  type ValidationErrors = import("./topogram-types.js").ValidationErrors;
  type TopogramFieldMap = import("./topogram-types.js").TopogramFieldMap;
  type TopogramRegistry = import("./topogram-types.js").TopogramRegistry;
  type ResolverBacklinkIndex = import("./topogram-types.js").ResolverBacklinkIndex;
}
