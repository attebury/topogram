import { PrismaClient } from "@prisma/client";
import type { TodoRepository } from "../repositories";
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

import { HttpError } from "../../server/helpers";

type StoredExportJob = GetTaskExportJobResult & {
  archive: Uint8Array;
};

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function nextCursor<T extends { created_at: Date | string }>(items: T[]): string {
  return items.length > 0 ? iso(items[items.length - 1]!.created_at) || "" : "";
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

function mapProjectRecord(project: {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  owner_id: string | null;
  created_at: Date | string;
}): GetProjectResult {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    status: project.status,
    owner_id: project.owner_id ?? undefined,
    created_at: iso(project.created_at)!
  };
}

function mapUserRecord(user: {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: Date | string;
}): GetUserResult {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    is_active: user.is_active,
    created_at: iso(user.created_at)!
  };
}

function mapTaskRecord(task: {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id: string | null;
  project_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  due_at: Date | string | null;
}): GetTaskResult {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    priority: task.priority,
    owner_id: task.owner_id ?? undefined,
    project_id: task.project_id,
    created_at: iso(task.created_at)!,
    updated_at: iso(task.updated_at)!,
    completed_at: iso(task.completed_at),
    due_at: iso(task.due_at)
  };
}

export class PrismaTodoRepository implements TodoRepository {
  private readonly exportJobs = new Map<string, StoredExportJob>();

  constructor(private readonly prisma: PrismaClient) {}

  async listProjectOptions(): Promise<LookupOption[]> {
    const projects = await this.prisma.project.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ name: "asc" }]
    });
    return projects.map((project) => ({ value: project.id, label: project.name }));
  }

  async listUserOptions(): Promise<LookupOption[]> {
    const users = await this.prisma.user.findMany({
      where: { is_active: true },
      orderBy: [{ display_name: "asc" }]
    });
    return users.map((user) => ({ value: user.id, label: user.display_name }));
  }

  async getProject(input: GetProjectInput): Promise<GetProjectResult> {
    const project = await this.prisma.project.findUnique({ where: { id: input.project_id } });
    if (!project) throw new HttpError(404, "cap_get_project_not_found", "Project not found");
    return mapProjectRecord(project);
  }

  async listProjects(input: ListProjectsInput): Promise<ListProjectsResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const projects = await this.prisma.project.findMany({
      where: { ...(input.after ? { created_at: { lt: new Date(input.after) } } : {}) },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = projects.slice(0, take).map(mapProjectRecord);
    return {
      items: page,
      next_cursor: nextCursor(projects.slice(0, take))
    };
  }

  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const now = new Date();
    if (input.owner_id) {
      const owner = await this.prisma.user.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "cap_create_project_invalid_request", "Project owner must be active");
    }
    const project = await this.prisma.project.create({
      data: {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "active",
        owner_id: input.owner_id ?? null,
        created_at: now
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_create_project_conflict", "Project name already exists");
      }
      throw error;
    });
    return mapProjectRecord(project);
  }

  async updateProject(input: UpdateProjectInput): Promise<UpdateProjectResult> {
    if (input.owner_id) {
      const owner = await this.prisma.user.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "cap_update_project_invalid_request", "Project owner must be active");
    }
    const project = await this.prisma.project.update({
      where: { id: input.project_id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.owner_id !== undefined ? { owner_id: input.owner_id ?? null } : {})
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_update_project_conflict", "Project name already exists");
      }
      throw new HttpError(404, "cap_get_project_not_found", error instanceof Error ? error.message : "Project not found");
    });
    return mapProjectRecord(project);
  }

  async getUser(input: GetUserInput): Promise<GetUserResult> {
    const user = await this.prisma.user.findUnique({ where: { id: input.user_id } });
    if (!user) throw new HttpError(404, "cap_get_user_not_found", "User not found");
    return mapUserRecord(user);
  }

  async listUsers(input: ListUsersInput): Promise<ListUsersResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const users = await this.prisma.user.findMany({
      where: { ...(input.after ? { created_at: { lt: new Date(input.after) } } : {}) },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = users.slice(0, take).map(mapUserRecord);
    return {
      items: page,
      next_cursor: nextCursor(users.slice(0, take))
    };
  }

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: input.email,
        display_name: input.display_name,
        is_active: input.is_active ?? true,
        created_at: now
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_create_user_conflict", "User email already exists");
      }
      throw error;
    });
    return mapUserRecord(user);
  }

  async updateUser(input: UpdateUserInput): Promise<UpdateUserResult> {
    const user = await this.prisma.user.update({
      where: { id: input.user_id },
      data: {
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.display_name !== undefined ? { display_name: input.display_name } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {})
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_update_user_conflict", "User email already exists");
      }
      throw new HttpError(404, "cap_get_user_not_found", error instanceof Error ? error.message : "User not found");
    });
    return mapUserRecord(user);
  }

  async getTask(input: GetTaskInput): Promise<GetTaskResult> {
    const task = await this.prisma.task.findUnique({ where: { id: input.task_id } });
    if (!task) throw new HttpError(404, "cap_get_task_not_found", "Task not found");
    return mapTaskRecord(task);
  }

  async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const tasks = await this.prisma.task.findMany({
      where: {
        project_id: input.project_id ?? undefined,
        owner_id: input.owner_id ?? undefined,
        status: input.status ?? undefined,
        ...(input.after ? { created_at: { lt: new Date(input.after) } } : {})
      },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = tasks.slice(0, take).map(mapTaskRecord);
    return {
      items: page,
      next_cursor: nextCursor(tasks.slice(0, take))
    };
  }

  async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    const project = await this.prisma.project.findUnique({ where: { id: input.project_id } });
    if (!project) throw new HttpError(400, "cap_create_task_invalid_request", "Project does not exist");
    if (project.status === "archived") throw new HttpError(409, "rule_no_task_creation_in_archived_project", "Cannot create tasks in archived projects");
    if (input.owner_id) {
      const owner = await this.prisma.user.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "rule_only_active_users_may_own_tasks", "Task owner must be active");
    }
    const now = new Date();
    const task = await this.prisma.task.create({
      data: {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description ?? null,
        status: input.owner_id ? "active" : "draft",
        priority: input.priority ?? "medium",
        owner_id: input.owner_id ?? null,
        project_id: input.project_id,
        created_at: now,
        updated_at: now,
        completed_at: null,
        due_at: input.due_at ? new Date(input.due_at) : null
      }
    });
    return mapTaskRecord(task);
  }

  async updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult> {
    if (input.owner_id) {
      const owner = await this.prisma.user.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "rule_only_active_users_may_own_tasks", "Task owner must be active");
    }
    const task = await this.prisma.task.update({
      where: { id: input.task_id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.owner_id !== undefined ? { owner_id: input.owner_id ?? null } : {}),
        ...(input.due_at !== undefined ? { due_at: input.due_at ? new Date(input.due_at) : null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updated_at: new Date()
      }
    }).catch((error) => {
      throw new HttpError(404, "task_not_found", error instanceof Error ? error.message : "Task not found");
    });
    return mapTaskRecord(task);
  }

  async completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
    const completedAt = input.completed_at ? new Date(input.completed_at) : new Date();
    const task = await this.prisma.task.update({
      where: { id: input.task_id },
      data: { status: "completed", completed_at: completedAt, updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "task_not_found", error instanceof Error ? error.message : "Task not found");
    });
    return mapTaskRecord(task);
  }

  async deleteTask(input: DeleteTaskInput): Promise<DeleteTaskResult> {
    const task = await this.prisma.task.update({
      where: { id: input.task_id },
      data: { status: "archived", updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "cap_delete_task_not_found", error instanceof Error ? error.message : "Task not found");
    });
    return mapTaskRecord(task);
  }

  async exportTasks(input: ExportTasksInput): Promise<ExportTasksResult> {
    const jobId = crypto.randomUUID();
    const submittedAt = new Date();
    const statusUrl = `/task-exports/${jobId}`;
    const archive = new TextEncoder().encode(JSON.stringify({ exported_at: submittedAt.toISOString(), filters: input }, null, 2));
    this.exportJobs.set(jobId, {
      job_id: jobId,
      status: "accepted",
      status_url: statusUrl,
      submitted_at: submittedAt.toISOString(),
      archive
    });
    queueMicrotask(() => {
      const existing = this.exportJobs.get(jobId);
      if (!existing) return;
      this.exportJobs.set(jobId, {
        ...existing,
        status: "completed",
        completed_at: new Date().toISOString(),
        download_url: `${statusUrl}/download`
      });
    });
    return { job_id: jobId, status: "accepted", status_url: statusUrl, submitted_at: submittedAt.toISOString() };
  }

  async getTaskExportJob(input: GetTaskExportJobInput): Promise<GetTaskExportJobResult> {
    const job = this.exportJobs.get(input.job_id);
    if (!job) throw new HttpError(404, "cap_get_task_export_job_not_found", "Export job not found");
    return {
      job_id: job.job_id,
      status: job.status,
      status_url: job.status_url,
      submitted_at: job.submitted_at,
      completed_at: job.completed_at,
      expires_at: job.expires_at,
      download_url: job.download_url,
      error_message: job.error_message
    };
  }

  async downloadTaskExport(input: DownloadTaskExportInput): Promise<DownloadTaskExportResult> {
    const job = this.exportJobs.get(input.job_id);
    if (!job) throw new HttpError(404, "cap_download_task_export_not_found", "Export job not found");
    if (job.status !== "completed" || !job.download_url) throw new HttpError(409, "cap_download_task_export_not_ready", "Export job is not ready");
    return { body: job.archive, contentType: "application/zip", filename: "task-export.zip" };
  }

  async markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult> {
    const job = this.exportJobs.get(input.job_id);
    if (!job) throw new HttpError(404, "cap_get_task_export_job_not_found", "Export job not found");
    this.exportJobs.set(input.job_id, {
      ...job,
      status: input.state as "accepted" | "running" | "completed" | "failed" | "expired",
      completed_at: input.state === "completed" ? new Date().toISOString() : job.completed_at,
      download_url: input.download_url ?? job.download_url,
      error_message: input.error_message
    });
    return { job_id: input.job_id, state: input.state as "accepted" | "running" | "completed" | "failed" | "expired" };
  }
}
