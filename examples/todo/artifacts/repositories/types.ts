export interface GetTaskInput {
  task_id: string;
}

export interface GetTaskResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  owner_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface ListTasksInput {
  project_id?: string;
  owner_id?: string;
  status?: "draft" | "active" | "completed" | "archived";
  after?: string;
  limit?: number;
}

export interface ListTasksResultItem {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  owner_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface ListTasksResult {
  items: ListTasksResultItem[];
  next_cursor: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  owner_id?: string;
  project_id: string;
  due_at?: string;
}

export interface CreateTaskResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  owner_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface UpdateTaskInput {
  task_id: string;
  title?: string;
  description?: string;
  owner_id?: string;
  due_at?: string;
  status?: "draft" | "active" | "completed" | "archived";
}

export interface UpdateTaskResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  owner_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface CompleteTaskInput {
  task_id: string;
  completed_at?: string;
}

export interface CompleteTaskResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  owner_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface DeleteTaskInput {
  task_id: string;
}

export interface DeleteTaskResult {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  owner_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_at?: string;
}

export interface ExportTasksInput {
  project_id?: string;
  owner_id?: string;
  status?: "draft" | "active" | "completed" | "archived";
  callback_url?: string;
}

export interface ExportTasksResult {
  job_id: string;
  status: string;
  status_url: string;
  submitted_at: string;
}

export interface GetTaskExportJobInput {
  job_id: string;
}

export interface GetTaskExportJobResult {
  job_id: string;
  status: "accepted" | "running" | "completed" | "failed" | "expired";
  status_url: string;
  submitted_at: string;
  completed_at?: string;
  expires_at?: string;
  download_url?: string;
  error_message?: string;
}

export interface DownloadTaskExportInput {
  job_id: string;
}

export interface DownloadTaskExportResult {
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
