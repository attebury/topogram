import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { TodoRepository } from "../repositories";
import { tasksTable, projectsTable, usersTable } from "../schema";
import type {
  GetProjectInput,
  GetProjectResult,
  ListProjectsInput,
  ListProjectsResult,
  CreateProjectInput,
  CreateProjectResult,
  UpdateProjectInput,
  UpdateProjectResult,
  GetUserInput,
  GetUserResult,
  ListUsersInput,
  ListUsersResult,
  CreateUserInput,
  CreateUserResult,
  UpdateUserInput,
  UpdateUserResult,
  GetTaskInput,
  GetTaskResult,
  ListTasksInput,
  ListTasksResult,
  CreateTaskInput,
  CreateTaskResult,
  UpdateTaskInput,
  UpdateTaskResult,
  CompleteTaskInput,
  CompleteTaskResult,
  DeleteTaskInput,
  DeleteTaskResult,
  ExportTasksInput,
  ExportTasksResult,
  GetTaskExportJobInput,
  GetTaskExportJobResult,
  DownloadTaskExportInput,
  DownloadTaskExportResult,
  MarkExportJobCompletedInput,
  MarkExportJobCompletedResult,
  LookupOption,
} from "../types";

export class DrizzleTodoRepository implements TodoRepository {
  constructor(private readonly db: NodePgDatabase<Record<string, never>>) {}

  async listProjectOptions(): Promise<LookupOption[]> {
    void this.db;
    throw new Error("listProjectOptions is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async listUserOptions(): Promise<LookupOption[]> {
    void this.db;
    throw new Error("listUserOptions is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async getProject(input: GetProjectInput): Promise<GetProjectResult> {
    void this.db;
    throw new Error("getProject is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async listProjects(input: ListProjectsInput): Promise<ListProjectsResult> {
    void this.db;
    throw new Error("listProjects is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    void this.db;
    throw new Error("createProject is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async updateProject(input: UpdateProjectInput): Promise<UpdateProjectResult> {
    void this.db;
    throw new Error("updateProject is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async getUser(input: GetUserInput): Promise<GetUserResult> {
    void this.db;
    throw new Error("getUser is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async listUsers(input: ListUsersInput): Promise<ListUsersResult> {
    void this.db;
    throw new Error("listUsers is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    void this.db;
    throw new Error("createUser is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async updateUser(input: UpdateUserInput): Promise<UpdateUserResult> {
    void this.db;
    throw new Error("updateUser is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async getTask(input: GetTaskInput): Promise<GetTaskResult> {
    void this.db;
    throw new Error("getTask is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
    void this.db;
    throw new Error("listTasks is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    void this.db;
    throw new Error("createTask is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult> {
    void this.db;
    throw new Error("updateTask is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
    void this.db;
    throw new Error("completeTask is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async deleteTask(input: DeleteTaskInput): Promise<DeleteTaskResult> {
    void this.db;
    throw new Error("deleteTask is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async exportTasks(input: ExportTasksInput): Promise<ExportTasksResult> {
    void this.db;
    throw new Error("exportTasks is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async getTaskExportJob(input: GetTaskExportJobInput): Promise<GetTaskExportJobResult> {
    void this.db;
    throw new Error("getTaskExportJob is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async downloadTaskExport(input: DownloadTaskExportInput): Promise<DownloadTaskExportResult> {
    void this.db;
    throw new Error("downloadTaskExport is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

  async markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult> {
    void this.db;
    throw new Error("markExportJobCompleted is not implemented yet. Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.");
  }

}
