export interface GetCollectionInput {
  collection_id: string;
}

export interface GetCollectionResult {
  id: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  owner_id?: string;
  created_at: string;
}

export interface ListCollectionsInput {
  after?: string;
  limit?: number;
}

export interface ListCollectionsResultItem {
  id: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  owner_id?: string;
  created_at: string;
}

export interface ListCollectionsResult {
  items: ListCollectionsResultItem[];
  next_cursor: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  status: "active" | "archived";
  owner_id?: string;
}

export interface CreateCollectionResult {
  id: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  owner_id?: string;
  created_at: string;
}

export interface UpdateCollectionInput {
  collection_id: string;
  name?: string;
  description?: string;
  status?: "active" | "archived";
  owner_id?: string;
}

export interface UpdateCollectionResult {
  id: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  owner_id?: string;
  created_at: string;
}

export interface GetMemberInput {
  member_id: string;
}

export interface GetMemberResult {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface ListMembersInput {
  after?: string;
  limit?: number;
}

export interface ListMembersResultItem {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface ListMembersResult {
  items: ListMembersResultItem[];
  next_cursor: string;
}

export interface CreateMemberInput {
  email: string;
  display_name: string;
  is_active: boolean;
}

export interface CreateMemberResult {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface UpdateMemberInput {
  member_id: string;
  email?: string;
  display_name?: string;
  is_active?: boolean;
}

export interface UpdateMemberResult {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface GetItemInput {
  item_id: string;
}

export interface GetItemResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface ListItemsInput {
  collection_id?: string;
  owner_id?: string;
  status?: "draft" | "active" | "completed" | "archived";
  after?: string;
  limit?: number;
}

export interface ListItemsResultItem {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface ListItemsResult {
  items: ListItemsResultItem[];
  next_cursor: string;
}

export interface CreateItemInput {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  due_at?: string;
}

export interface CreateItemResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface UpdateItemInput {
  item_id: string;
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  owner_id?: string;
  due_at?: string;
  status?: "draft" | "active" | "completed" | "archived";
}

export interface UpdateItemResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface CompleteItemInput {
  item_id: string;
  completed_at?: string;
}

export interface CompleteItemResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface DeleteItemInput {
  item_id: string;
}

export interface DeleteItemResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id?: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface ExportItemsInput {
  collection_id?: string;
  owner_id?: string;
  status?: "draft" | "active" | "completed" | "archived";
  callback_url?: string;
}

export interface ExportItemsResult {
  job_id: string;
  status: string;
  status_url: string;
  submitted_at: string;
}

export interface GetItemExportJobInput {
  job_id: string;
}

export interface GetItemExportJobResult {
  job_id: string;
  status: "accepted" | "running" | "completed" | "failed" | "expired";
  status_url: string;
  submitted_at: string;
  completed_at?: string;
  expires_at?: string;
  download_url?: string;
  error_message?: string;
}

export interface DownloadItemExportInput {
  job_id: string;
}

export interface DownloadItemExportResult {
  body: Uint8Array;
  contentType: string;
  filename: string;
}

export interface LookupOption {
  value: string;
  label: string;
}

export interface MarkExportJobCompletedInput {
  job_id: string;
  state: string;
  download_url?: string;
  error_message?: string;
}

export interface MarkExportJobCompletedResult {
  job_id: string;
  state: string;
}
