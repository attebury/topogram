export type ApiReference = {
  id?: string;
  kind?: string;
  target?: {
    id?: string;
    kind?: string;
  };
  [key: string]: any;
};

export type ApiField = {
  name: string;
  sourceName?: string;
  fieldType?: string;
  requiredness?: string;
  defaultValue?: string | number | boolean | null;
  transport: {
    location?: string;
    wireName?: string;
  };
  [key: string]: any;
};

export type ApiShape = {
  id: string;
  kind?: string;
  name?: string;
  description?: string;
  fields?: ApiField[];
  projectedFields?: ApiField[];
  [key: string]: any;
};

export type ApiCapability = {
  id: string;
  kind?: string;
  name?: string;
  description?: string;
  actors: ApiReference[];
  input: ApiReference[];
  output: ApiReference[];
  reads: ApiReference[];
  creates: ApiReference[];
  updates: ApiReference[];
  deletes: ApiReference[];
  [key: string]: any;
};

export type ApiGraph = {
  statements: any[];
  byKind: Record<string, any[]>;
  [key: string]: any;
};

export type ApiMetadata = {
  projection?: any;
  method?: string;
  path?: string;
  success?: number;
  auth?: string;
  request?: string;
  response?: any;
  fieldBindings?: any[];
  errorMappings?: any[];
  preconditions?: any[];
  idempotency?: any[];
  cache?: any[];
  delete?: any[];
  async?: any[];
  status?: any[];
  download?: any[];
  authz?: any[];
  callbacks?: any[];
  [key: string]: any;
};

export type ApiContract = {
  capability?: any;
  endpoint?: any;
  requestContract?: any;
  responseContract?: any;
  errorCases?: any[];
  [key: string]: any;
};

export type ApiOptions = {
  capabilityId?: string | null;
  [key: string]: any;
};

export type JsonSchema = {
  type?: string;
  format?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  [key: string]: any;
};
