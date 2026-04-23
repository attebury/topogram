import type {
  CompleteTaskInput,
  CompleteTaskResult,
  CreateTaskInput,
  CreateTaskResult,
  DeleteTaskInput,
  DeleteTaskResult,
  DownloadTaskExportInput,
  DownloadTaskExportResult,
  ExportTasksInput,
  ExportTasksResult,
  GetTaskExportJobInput,
  GetTaskExportJobResult,
  GetTaskInput,
  GetTaskResult,
  ListTasksInput,
  ListTasksResult,
  LookupOption,
  MarkExportJobCompletedInput,
  MarkExportJobCompletedResult,
  UpdateTaskInput,
  UpdateTaskResult,
} from "./types";

export interface TaskRepository {
  getTask(input: GetTaskInput): Promise<GetTaskResult>;
  listTasks(input: ListTasksInput): Promise<ListTasksResult>;
  createTask(input: CreateTaskInput): Promise<CreateTaskResult>;
  updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult>;
  completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult>;
  deleteTask(input: DeleteTaskInput): Promise<DeleteTaskResult>;
  exportTasks(input: ExportTasksInput): Promise<ExportTasksResult>;
  getTaskExportJob(input: GetTaskExportJobInput): Promise<GetTaskExportJobResult>;
  listProjectOptions(): Promise<LookupOption[]>;
  listUserOptions(): Promise<LookupOption[]>;
  downloadTaskExport(input: DownloadTaskExportInput): Promise<DownloadTaskExportResult>;
  markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult>;
}
