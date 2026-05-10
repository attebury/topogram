export type ImportPaths = {
  repoRoot: string;
  workspaceRoot: string;
  topogramRoot: string;
  [key: string]: any;
};

export type ImportReadHelpers = {
  readTextIfExists(filePath: string): string | null;
  [key: string]: any;
};

export type ImportRouteRecord = {
  endpoint?: {
    path?: string;
  };
  path?: string;
  method?: string;
  handler_hint?: string;
  id_hint?: string;
  entity_id?: string | null;
  auth_hint?: string;
  tags?: string[];
  [key: string]: any;
};

export type ImportCandidateRecord = {
  kind: string;
  id?: string;
  id_hint?: string;
  idHint?: string;
  label: string;
  confidence?: string;
  source_kind?: string;
  source_of_truth?: string;
  [key: string]: any;
};

export type NavigationStructure = {
  hasHeader?: boolean;
  hasSidebar?: boolean;
  hasTopbar?: boolean;
  hasBottomTabs?: boolean;
  hasTabs?: boolean;
  hasBreadcrumbs?: boolean;
  hasCommandPalette?: boolean;
  hasSegmentedControl?: boolean;
  hasRail?: boolean;
  navLinks?: string[];
  [key: string]: any;
};
