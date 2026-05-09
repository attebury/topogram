export type WorkflowRecord = Record<string, any>;

export type WorkflowScalar = string | number | boolean | null;

export type WorkflowJson =
  | WorkflowScalar
  | WorkflowJson[]
  | { [key: string]: WorkflowJson };

export type WorkflowFiles = Record<string, any>;

export type WorkflowOptions = Record<string, any>;

export interface WorkspacePaths {
  inputRoot: string;
  topogramRoot: string;
  workspaceRoot: string;
  exampleRoot: string;
  repoRoot: string;
  bootstrappedTopogramRoot: boolean;
}

export interface MarkdownFrontmatter {
  metadata: WorkflowRecord;
  body: string;
}

export interface WorkflowResult {
  type?: string;
  version?: number | string;
  summary: WorkflowRecord;
  files?: WorkflowFiles;
  defaultOutDir?: string;
}

export type ResolvedGraph = WorkflowRecord;

export type CandidateRecord = WorkflowRecord;

export interface CandidateBundle extends WorkflowRecord {
  id: string;
  label: string;
  actors: CandidateRecord[];
  roles: CandidateRecord[];
  enums: CandidateRecord[];
  entities: CandidateRecord[];
  shapes: CandidateRecord[];
  capabilities: CandidateRecord[];
  verifications: CandidateRecord[];
  workflows: CandidateRecord[];
  widgets: CandidateRecord[];
  screens: CandidateRecord[];
  uiRoutes: CandidateRecord[];
  docs: CandidateRecord[];
  docLinkSuggestions: CandidateRecord[];
  docMetadataPatches: CandidateRecord[];
}

export type CandidateBundles = CandidateBundle[];

export type ImportArtifacts = WorkflowRecord;

export type AdoptionPlanItem = WorkflowRecord;

export type ProjectionImpact = WorkflowRecord;

export type UiImpact = WorkflowRecord;

export type WorkflowImpact = WorkflowRecord;

export type AuthHint = WorkflowRecord;

export type Diagnostic = WorkflowRecord;

declare global {
  type WorkflowRecord = import("./types.js").WorkflowRecord;
  type WorkflowFiles = import("./types.js").WorkflowFiles;
  type WorkflowOptions = import("./types.js").WorkflowOptions;
  type WorkspacePaths = import("./types.js").WorkspacePaths;
  type MarkdownFrontmatter = import("./types.js").MarkdownFrontmatter;
  type WorkflowResult = import("./types.js").WorkflowResult;
  type ResolvedGraph = import("./types.js").ResolvedGraph;
  type CandidateRecord = import("./types.js").CandidateRecord;
  type CandidateBundle = import("./types.js").CandidateBundle;
  type CandidateBundles = import("./types.js").CandidateBundles;
  type ImportArtifacts = import("./types.js").ImportArtifacts;
  type AdoptionPlanItem = import("./types.js").AdoptionPlanItem;
  type ProjectionImpact = import("./types.js").ProjectionImpact;
  type UiImpact = import("./types.js").UiImpact;
  type WorkflowImpact = import("./types.js").WorkflowImpact;
  type AuthHint = import("./types.js").AuthHint;
  type Diagnostic = import("./types.js").Diagnostic;
}
