export interface CreateNewProjectOptions {
  targetPath: string;
  templateName?: string;
  engineRoot: string;
  templatesRoot: string;
  templateProvenance?: CatalogTemplateProvenance | null;
}

export interface TemplateUpdatePlanOptions {
  projectRoot: string;
  projectConfig: Record<string, any>;
  templateName?: string | null;
  templatesRoot: string;
}

export type TemplateUpdateFileActionOptions = TemplateUpdatePlanOptions & {
  filePath: string;
  action: "accept-current" | "accept-candidate" | "delete-current";
};

export interface TemplateOwnedFileRecord {
  path: string;
  sha256: string;
  size: number;
}

export interface TemplateManifest {
  id: string;
  version: string;
  kind: string;
  topogramVersion: string;
  includesExecutableImplementation?: boolean;
  description?: string;
  starterScripts?: Record<string, string>;
}

export interface TemplateTopologySummary {
  surfaces: string[];
  generators: string[];
  stack: string;
}

export interface TemplatePolicy {
  version: string;
  allowedSources: Array<"local" | "package">;
  allowedTemplateIds: string[];
  allowedPackageScopes?: string[];
  executableImplementation: "allow" | "warn" | "deny";
  pinnedVersions?: Record<string, string>;
}

export interface TemplatePolicyInfo {
  path: string;
  policy: TemplatePolicy | null;
  exists: boolean;
  diagnostics: TemplateUpdateDiagnostic[];
}

export interface TemplateUpdateDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  path: string | null;
  suggestedFix: string | null;
  step: string | null;
}

export interface ResolvedTemplate {
  requested: string;
  root: string;
  manifest: TemplateManifest;
  source: "local" | "package";
  packageSpec: string | null;
}

export interface CatalogTemplateProvenance {
  id: string;
  source: string;
  package: string;
  version: string;
  packageSpec: string;
  includesExecutableImplementation?: boolean;
}
