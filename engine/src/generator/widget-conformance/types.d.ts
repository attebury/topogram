export type WidgetReference = {
  id?: string;
  kind?: string;
  target?: {
    id?: string;
    kind?: string;
  };
  [key: string]: any;
};

export type WidgetGraph = {
  statements: any[];
  byKind: Record<string, any[]>;
  [key: string]: any;
};

export type WidgetProjection = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  realizes?: WidgetReference[];
  uiScreens?: any[];
  uiScreenRegions?: any[];
  widgetBindings?: WidgetUsage[];
  loc?: {
    file?: string;
  };
  [key: string]: any;
};

export type WidgetContract = {
  id?: string;
  name?: string;
  category?: string;
  version?: string;
  status?: string;
  props?: any[];
  events?: any[];
  behaviors?: WidgetBehavior[];
  behavior?: WidgetBehavior[];
  approvals?: any[];
  dependencies?: any[];
  patterns?: string[];
  regions?: string[];
  [key: string]: any;
};

export type WidgetStatement = {
  id: string;
  name?: string;
  category?: string;
  version?: string;
  status?: string;
  widgetContract?: WidgetContract;
  loc?: {
    file?: string;
  };
  [key: string]: any;
};

export type WidgetUsage = {
  widget?: WidgetReference;
  screenId?: string;
  region?: string;
  dataBindings?: any[];
  eventBindings?: any[];
  [key: string]: any;
};

export type WidgetUsageEntry = {
  projection: WidgetProjection;
  sourceProjection: WidgetProjection;
  usage: WidgetUsage;
  index: number;
};

export type WidgetBehavior = {
  kind?: string;
  source?: string;
  status?: string;
  directives?: any;
  dataDependencies?: any[];
  emits?: any[];
  actions?: any[];
  effects?: any[];
  [key: string]: any;
};

export type WidgetUsageReport = {
  key?: string;
  projection?: any;
  source_projection?: any;
  screen?: any;
  region?: string | null;
  widget?: any;
  behavior_realizations?: WidgetBehavior[];
  [key: string]: any;
};

export type WidgetProjectionUsageRecord = WidgetUsageReport & {
  outcome: "pass" | "warning" | "error";
  check_codes: string[];
};

export type WidgetConformanceReport = {
  filters?: any;
  summary?: any;
  projection_usages?: WidgetUsageReport[];
  checks?: any[];
  write_scope?: any;
  impact?: any;
  [key: string]: any;
};

export type WidgetOptions = {
  widgetId?: string | null;
  componentId?: string | null;
  projectionId?: string | null;
  [key: string]: any;
};
