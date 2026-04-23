import type {
  CompleteTaskInput,
  CompleteTaskResult,
  CreateProjectInput,
  CreateProjectResult,
  CreateTaskInput,
  CreateTaskResult,
  CreateUserInput,
  CreateUserResult,
  DeleteTaskInput,
  DeleteTaskResult,
  DownloadTaskExportInput,
  DownloadTaskExportResult,
  ExportTasksInput,
  ExportTasksResult,
  GetProjectInput,
  GetProjectResult,
  GetTaskExportJobInput,
  GetTaskExportJobResult,
  GetTaskInput,
  GetTaskResult,
  GetUserInput,
  GetUserResult,
  ListProjectsInput,
  ListProjectsResult,
  ListTasksInput,
  ListTasksResult,
  ListUsersInput,
  ListUsersResult,
  LookupOption,
  MarkExportJobCompletedInput,
  MarkExportJobCompletedResult,
  UpdateProjectInput,
  UpdateProjectResult,
  UpdateTaskInput,
  UpdateTaskResult,
  UpdateUserInput,
  UpdateUserResult,
} from "./types";

export interface TodoRepository {
  getProject(input: GetProjectInput): Promise<GetProjectResult>;
  listProjects(input: ListProjectsInput): Promise<ListProjectsResult>;
  createProject(input: CreateProjectInput): Promise<CreateProjectResult>;
  updateProject(input: UpdateProjectInput): Promise<UpdateProjectResult>;
  getUser(input: GetUserInput): Promise<GetUserResult>;
  listUsers(input: ListUsersInput): Promise<ListUsersResult>;
  createUser(input: CreateUserInput): Promise<CreateUserResult>;
  updateUser(input: UpdateUserInput): Promise<UpdateUserResult>;
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
