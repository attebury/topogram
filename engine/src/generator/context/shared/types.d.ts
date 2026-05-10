export type ContextReference = {
  id?: string;
  kind?: string;
  target?: {
    id?: string;
    kind?: string;
  };
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
