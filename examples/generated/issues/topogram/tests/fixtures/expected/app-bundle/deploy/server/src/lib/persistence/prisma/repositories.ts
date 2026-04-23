import { PrismaClient } from "@prisma/client";
import type { IssueRepository } from "../repositories";
import type {
  GetIssueInput,
  GetIssueResult,
  ListIssuesInput,
  ListIssuesResult,
  CreateIssueInput,
  CreateIssueResult,
  UpdateIssueInput,
  UpdateIssueResult,
  CloseIssueInput,
  CloseIssueResult,
  LookupOption,
} from "../types";

import { HttpError } from "../../server/helpers";

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function mapIssueRecord(issue: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  board_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  closed_at: Date | string | null;
  priority: string | null;
}): GetIssueResult {
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description ?? undefined,
    status: issue.status as GetIssueResult["status"],
    assignee_id: issue.assignee_id ?? undefined,
    board_id: issue.board_id,
    created_at: iso(issue.created_at)!,
    updated_at: iso(issue.updated_at)!,
    closed_at: iso(issue.closed_at),
    priority: issue.priority ?? undefined
  };
}

export class PrismaIssueRepository implements IssueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listBoardOptions(): Promise<LookupOption[]> {
    const boards = await this.prisma.board.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ name: "asc" }]
    });
    return boards.map((board) => ({ value: board.id, label: board.name }));
  }

  async listUserOptions(): Promise<LookupOption[]> {
    const users = await this.prisma.user.findMany({
      where: { is_active: true },
      orderBy: [{ display_name: "asc" }]
    });
    return users.map((user) => ({ value: user.id, label: user.display_name }));
  }

  async getIssue(input: GetIssueInput): Promise<GetIssueResult> {
    const issue = await this.prisma.issue.findUnique({ where: { id: input.issue_id } });
    if (!issue) throw new HttpError(404, "cap_get_issue_not_found", "Issue not found");
    return mapIssueRecord(issue);
  }

  async listIssues(input: ListIssuesInput): Promise<ListIssuesResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const issues = await this.prisma.issue.findMany({
      where: {
        board_id: input.board_id ?? undefined,
        assignee_id: input.assignee_id ?? undefined,
        status: input.status ?? undefined,
        ...(input.after ? { created_at: { lt: new Date(input.after) } } : {})
      },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = issues.slice(0, take).map(mapIssueRecord);
    return { items: page, next_cursor: page.length > 0 ? page[page.length - 1]!.created_at : "" };
  }

  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    const board = await this.prisma.board.findUnique({ where: { id: input.board_id } });
    if (!board) throw new HttpError(400, "cap_create_issue_invalid_request", "Board does not exist");
    if (board.status === "archived") throw new HttpError(409, "rule_no_issue_creation_in_archived_board", "Cannot create issues in archived boards");
    if (input.assignee_id) {
      const assignee = await this.prisma.user.findUnique({ where: { id: input.assignee_id } });
      if (!assignee || !assignee.is_active) throw new HttpError(400, "rule_only_active_users_may_be_assigned_issues", "Issue assignee must be active");
    }
    const now = new Date();
    const issue = await this.prisma.issue.create({
      data: {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description ?? null,
        status: input.assignee_id ? "in_progress" : "open",
        assignee_id: input.assignee_id ?? null,
        board_id: input.board_id,
        created_at: now,
        updated_at: now,
        closed_at: null,
        priority: input.priority ?? null
      }
    });
    return mapIssueRecord(issue);
  }

  async updateIssue(input: UpdateIssueInput): Promise<UpdateIssueResult> {
    if (input.assignee_id) {
      const assignee = await this.prisma.user.findUnique({ where: { id: input.assignee_id } });
      if (!assignee || !assignee.is_active) throw new HttpError(400, "rule_only_active_users_may_be_assigned_issues", "Issue assignee must be active");
    }
    const issue = await this.prisma.issue.update({
      where: { id: input.issue_id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.assignee_id !== undefined ? { assignee_id: input.assignee_id ?? null } : {}),
        ...(input.priority !== undefined ? { priority: input.priority ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updated_at: new Date()
      }
    }).catch((error) => {
      throw new HttpError(404, "cap_get_issue_not_found", error instanceof Error ? error.message : "Issue not found");
    });
    return mapIssueRecord(issue);
  }

  async closeIssue(input: CloseIssueInput): Promise<CloseIssueResult> {
    const closedAt = input.closed_at ? new Date(input.closed_at) : new Date();
    const issue = await this.prisma.issue.update({
      where: { id: input.issue_id },
      data: { status: "closed", closed_at: closedAt, updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "cap_get_issue_not_found", error instanceof Error ? error.message : "Issue not found");
    });
    return mapIssueRecord(issue);
  }
}
