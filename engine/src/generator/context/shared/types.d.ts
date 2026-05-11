export type ContextReference = {
  id?: string;
  kind?: string;
  target?: {
    id?: string;
    kind?: string;
  };
  [key: string]: any;
};

export type ContextField = {
  name?: string;
  fieldType?: string;
  requiredness?: string;
  defaultValue?: unknown;
  [key: string]: any;
};

export type ContextProjection = ContextStatement & {
  type?: string;
  realizes?: ContextReference[];
  outputs?: string[];
  uiScreens?: any[];
  uiRoutes?: any[];
  uiScreenRegions?: any[];
  uiCollections?: any[];
  uiActions?: any[];
  uiVisibility?: any[];
  uiLookups?: any[];
  uiDesign?: any[];
  widgetBindings?: ContextWidgetUsage[];
  dbTables?: any[];
  dbColumns?: any[];
  dbRelations?: any[];
  http?: any[];
  httpResponses?: any[];
};

export type ContextCapability = ContextStatement & {
  actors?: ContextReference[];
  roles?: ContextReference[];
  reads?: ContextReference[];
  creates?: ContextReference[];
  updates?: ContextReference[];
  deletes?: ContextReference[];
  input?: ContextReference[];
  output?: ContextReference[];
};

export type ContextEntity = ContextStatement & {
  fields?: ContextField[];
  relations?: any[];
  keys?: any[];
};

export type ContextShape = ContextStatement & {
  derivedFrom?: ContextReference[];
  include?: string[];
  exclude?: string[];
  fields?: ContextField[];
  projectedFields?: ContextField[];
};

export type ContextWidget = ContextStatement & {
  category?: string;
  version?: string;
  status?: string;
  widgetContract?: {
    patterns?: string[];
    regions?: string[];
    behaviors?: any[];
    [key: string]: any;
  };
  props?: ContextField[];
  events?: any[];
  slots?: any[];
  behavior?: string[];
  behaviors?: any[];
  patterns?: string[];
  regions?: string[];
  approvals?: string[];
  lookups?: ContextReference[];
  dependencies?: ContextReference[];
};

export type ContextWidgetUsage = {
  widget?: ContextReference;
  screenId?: string;
  region?: string;
  dataBindings?: any[];
  eventBindings?: any[];
  [key: string]: any;
};

export type ContextStatement = {
  id: string;
  kind?: string;
  name?: string;
  description?: string;
  loc?: {
    file?: string;
  };
  resolvedDomain?: {
    id?: string;
  };
  [key: string]: any;
};

export type ContextDoc = {
  id: string;
  kind?: string;
  title?: string;
  loc?: {
    file?: string;
  };
  metadata?: any;
  relatedCapabilities?: string[];
  relatedWorkflows?: string[];
  [key: string]: any;
};

export type ContextGraph = {
  root?: string;
  workspaceRoot?: string;
  repoRoot?: string;
  statements: ContextStatement[];
  docs: ContextDoc[];
  byKind: Record<string, any[]>;
  [key: string]: any;
};

export type ContextSelectionOptions = {
  capabilityId?: string | null;
  workflowId?: string | null;
  projectionId?: string | null;
  widgetId?: string | null;
  componentId?: string | null;
  entityId?: string | null;
  journeyId?: string | null;
  surfaceId?: string | null;
  domainId?: string | null;
  pitchId?: string | null;
  requirementId?: string | null;
  acceptanceId?: string | null;
  taskId?: string | null;
  planId?: string | null;
  bugId?: string | null;
  documentId?: string | null;
  [key: string]: any;
};

export type ContextSelection = {
  kind: string;
  id: string;
};

export type VerificationTargets = {
  verification_ids?: string[];
  generated_checks?: string[];
  maintained_app_checks?: string[];
  rationale?: string | null;
  [key: string]: any;
};

export type MaintainedSeam = {
  seam_id?: string;
  label?: string;
  maintained_modules?: string[];
  emitted_dependencies?: string[];
  [key: string]: any;
};

export type MaintainedOutput = {
  output_id?: string;
  label?: string;
  kind?: string;
  maintained_files_in_scope?: string[];
  seams: MaintainedSeam[];
  proof_stories: any[];
  [key: string]: any;
};

export type MaintainedProofStory = {
  classification?: string;
  maintainedFiles?: string[];
  emittedDependencies?: string[];
  humanOwnedSeams?: string[];
  seamFamilyId?: string | null;
  seamFamilyLabel?: string | null;
  relativePath?: string;
  absolutePath?: string;
  reviewBoundary?: any;
  ownership_boundary?: any;
  [key: string]: any;
};

export type MaintainedBoundaryOptions = {
  proofStories?: MaintainedProofStory[];
  verificationTargets?: VerificationTargets | null;
  graph?: ContextGraph | null;
  [key: string]: any;
};

export type VerificationTargetOptions = {
  rationale?: string | null;
  includeMaintainedApp?: boolean;
  [key: string]: any;
};
