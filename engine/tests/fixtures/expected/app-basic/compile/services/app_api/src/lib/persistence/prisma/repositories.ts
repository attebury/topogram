import { PrismaClient } from "@prisma/client";
import type { AppBasicRepository } from "../repositories";
import type {
  GetCollectionInput,
  GetCollectionResult,
  ListCollectionsInput,
  ListCollectionsResult,
  CreateCollectionInput,
  CreateCollectionResult,
  UpdateCollectionInput,
  UpdateCollectionResult,
  GetMemberInput,
  GetMemberResult,
  ListMembersInput,
  ListMembersResult,
  CreateMemberInput,
  CreateMemberResult,
  UpdateMemberInput,
  UpdateMemberResult,
  GetItemInput,
  GetItemResult,
  ListItemsInput,
  ListItemsResult,
  CreateItemInput,
  CreateItemResult,
  UpdateItemInput,
  UpdateItemResult,
  CompleteItemInput,
  CompleteItemResult,
  DeleteItemInput,
  DeleteItemResult,
  ExportItemsInput,
  ExportItemsResult,
  GetItemExportJobInput,
  GetItemExportJobResult,
  DownloadItemExportInput,
  DownloadItemExportResult,
  MarkExportJobCompletedInput,
  MarkExportJobCompletedResult,
  LookupOption,
} from "../types";

import { HttpError } from "../../server/helpers";

type StoredExportJob = GetItemExportJobResult & {
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

function mapCollectionRecord(collection: {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  owner_id: string | null;
  created_at: Date | string;
}): GetCollectionResult {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description ?? undefined,
    status: collection.status,
    owner_id: collection.owner_id ?? undefined,
    created_at: iso(collection.created_at)!
  };
}

function mapMemberRecord(member: {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: Date | string;
}): GetMemberResult {
  return {
    id: member.id,
    email: member.email,
    display_name: member.display_name,
    is_active: member.is_active,
    created_at: iso(member.created_at)!
  };
}

function mapItemRecord(item: {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  owner_id: string | null;
  collection_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  due_at: Date | string | null;
}): GetItemResult {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? undefined,
    status: item.status,
    priority: item.priority,
    owner_id: item.owner_id ?? undefined,
    collection_id: item.collection_id,
    created_at: iso(item.created_at)!,
    updated_at: iso(item.updated_at)!,
    completed_at: iso(item.completed_at),
    due_at: iso(item.due_at)
  };
}

export class PrismaAppBasicRepository implements AppBasicRepository {
  private readonly exportJobs = new Map<string, StoredExportJob>();

  constructor(private readonly prisma: PrismaClient) {}

  async listCollectionOptions(): Promise<LookupOption[]> {
    const collections = await this.prisma.collection.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ name: "asc" }]
    });
    return collections.map((collection) => ({ value: collection.id, label: collection.name }));
  }

  async listMemberOptions(): Promise<LookupOption[]> {
    const members = await this.prisma.member.findMany({
      where: { is_active: true },
      orderBy: [{ display_name: "asc" }]
    });
    return members.map((member) => ({ value: member.id, label: member.display_name }));
  }

  async getCollection(input: GetCollectionInput): Promise<GetCollectionResult> {
    const collection = await this.prisma.collection.findUnique({ where: { id: input.collection_id } });
    if (!collection) throw new HttpError(404, "cap_get_collection_not_found", "Collection not found");
    return mapCollectionRecord(collection);
  }

  async listCollections(input: ListCollectionsInput): Promise<ListCollectionsResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const collections = await this.prisma.collection.findMany({
      where: { ...(input.after ? { created_at: { lt: new Date(input.after) } } : {}) },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = collections.slice(0, take).map(mapCollectionRecord);
    return {
      items: page,
      next_cursor: nextCursor(collections.slice(0, take))
    };
  }

  async createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
    const now = new Date();
    if (input.owner_id) {
      const owner = await this.prisma.member.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "cap_create_collection_invalid_request", "Collection owner must be active");
    }
    const collection = await this.prisma.collection.create({
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
        throw new HttpError(409, "cap_create_collection_conflict", "Collection name already exists");
      }
      throw error;
    });
    return mapCollectionRecord(collection);
  }

  async updateCollection(input: UpdateCollectionInput): Promise<UpdateCollectionResult> {
    if (input.owner_id) {
      const owner = await this.prisma.member.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "cap_update_collection_invalid_request", "Collection owner must be active");
    }
    const collection = await this.prisma.collection.update({
      where: { id: input.collection_id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.owner_id !== undefined ? { owner_id: input.owner_id ?? null } : {})
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_update_collection_conflict", "Collection name already exists");
      }
      throw new HttpError(404, "cap_get_collection_not_found", error instanceof Error ? error.message : "Collection not found");
    });
    return mapCollectionRecord(collection);
  }

  async getMember(input: GetMemberInput): Promise<GetMemberResult> {
    const member = await this.prisma.member.findUnique({ where: { id: input.member_id } });
    if (!member) throw new HttpError(404, "cap_get_member_not_found", "Member not found");
    return mapMemberRecord(member);
  }

  async listMembers(input: ListMembersInput): Promise<ListMembersResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const members = await this.prisma.member.findMany({
      where: { ...(input.after ? { created_at: { lt: new Date(input.after) } } : {}) },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = members.slice(0, take).map(mapMemberRecord);
    return {
      items: page,
      next_cursor: nextCursor(members.slice(0, take))
    };
  }

  async createMember(input: CreateMemberInput): Promise<CreateMemberResult> {
    const now = new Date();
    const member = await this.prisma.member.create({
      data: {
        id: crypto.randomUUID(),
        email: input.email,
        display_name: input.display_name,
        is_active: input.is_active ?? true,
        created_at: now
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_create_member_conflict", "Member email already exists");
      }
      throw error;
    });
    return mapMemberRecord(member);
  }

  async updateMember(input: UpdateMemberInput): Promise<UpdateMemberResult> {
    const member = await this.prisma.member.update({
      where: { id: input.member_id },
      data: {
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.display_name !== undefined ? { display_name: input.display_name } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {})
      }
    }).catch((error) => {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "cap_update_member_conflict", "Member email already exists");
      }
      throw new HttpError(404, "cap_get_member_not_found", error instanceof Error ? error.message : "Member not found");
    });
    return mapMemberRecord(member);
  }

  async getItem(input: GetItemInput): Promise<GetItemResult> {
    const item = await this.prisma.item.findUnique({ where: { id: input.item_id } });
    if (!item) throw new HttpError(404, "cap_get_item_not_found", "Item not found");
    return mapItemRecord(item);
  }

  async listItems(input: ListItemsInput): Promise<ListItemsResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const items = await this.prisma.item.findMany({
      where: {
        collection_id: input.collection_id ?? undefined,
        owner_id: input.owner_id ?? undefined,
        status: input.status ?? undefined,
        ...(input.after ? { created_at: { lt: new Date(input.after) } } : {})
      },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = items.slice(0, take).map(mapItemRecord);
    return {
      items: page,
      next_cursor: nextCursor(items.slice(0, take))
    };
  }

  async createItem(input: CreateItemInput): Promise<CreateItemResult> {
    const collection = await this.prisma.collection.findUnique({ where: { id: input.collection_id } });
    if (!collection) throw new HttpError(400, "cap_create_item_invalid_request", "Collection does not exist");
    if (collection.status === "archived") throw new HttpError(409, "rule_no_item_creation_in_archived_collection", "Cannot create items in archived collections");
    if (input.owner_id) {
      const owner = await this.prisma.member.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "rule_only_active_members_may_own_items", "Item owner must be active");
    }
    const now = new Date();
    const item = await this.prisma.item.create({
      data: {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description ?? null,
        status: input.owner_id ? "active" : "draft",
        priority: input.priority ?? "medium",
        owner_id: input.owner_id ?? null,
        collection_id: input.collection_id,
        created_at: now,
        updated_at: now,
        completed_at: null,
        due_at: input.due_at ? new Date(input.due_at) : null
      }
    });
    return mapItemRecord(item);
  }

  async updateItem(input: UpdateItemInput): Promise<UpdateItemResult> {
    if (input.owner_id) {
      const owner = await this.prisma.member.findUnique({ where: { id: input.owner_id } });
      if (!owner || !owner.is_active) throw new HttpError(400, "rule_only_active_members_may_own_items", "Item owner must be active");
    }
    const item = await this.prisma.item.update({
      where: { id: input.item_id },
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
      throw new HttpError(404, "item_not_found", error instanceof Error ? error.message : "Item not found");
    });
    return mapItemRecord(item);
  }

  async completeItem(input: CompleteItemInput): Promise<CompleteItemResult> {
    const completedAt = input.completed_at ? new Date(input.completed_at) : new Date();
    const item = await this.prisma.item.update({
      where: { id: input.item_id },
      data: { status: "completed", completed_at: completedAt, updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "item_not_found", error instanceof Error ? error.message : "Item not found");
    });
    return mapItemRecord(item);
  }

  async deleteItem(input: DeleteItemInput): Promise<DeleteItemResult> {
    const item = await this.prisma.item.update({
      where: { id: input.item_id },
      data: { status: "archived", updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "cap_delete_item_not_found", error instanceof Error ? error.message : "Item not found");
    });
    return mapItemRecord(item);
  }

  async exportItems(input: ExportItemsInput): Promise<ExportItemsResult> {
    const jobId = crypto.randomUUID();
    const submittedAt = new Date();
    const statusUrl = `/item-exports/${jobId}`;
    const archive = new TextEncoder().encode(JSON.stringify({ exported_at: submittedAt.toISOString(), filters: input }, null, 2));
    this.exportJobs.set(jobId, {
      job_id: jobId,
      status: "accepted",
      status_url: statusUrl,
      submitted_at: submittedAt.toISOString(),
      archive
    });
    queueMicroitem(() => {
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

  async getItemExportJob(input: GetItemExportJobInput): Promise<GetItemExportJobResult> {
    const job = this.exportJobs.get(input.job_id);
    if (!job) throw new HttpError(404, "cap_get_item_export_job_not_found", "Export job not found");
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

  async downloadItemExport(input: DownloadItemExportInput): Promise<DownloadItemExportResult> {
    const job = this.exportJobs.get(input.job_id);
    if (!job) throw new HttpError(404, "cap_download_item_export_not_found", "Export job not found");
    if (job.status !== "completed" || !job.download_url) throw new HttpError(409, "cap_download_item_export_not_ready", "Export job is not ready");
    return { body: job.archive, contentType: "application/zip", filename: "item-export.zip" };
  }

  async markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult> {
    const job = this.exportJobs.get(input.job_id);
    if (!job) throw new HttpError(404, "cap_get_item_export_job_not_found", "Export job not found");
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
