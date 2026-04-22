import { PrismaClient } from "@prisma/client";
import type { ArticleRepository } from "../repositories";
import type {
  GetArticleInput,
  GetArticleResult,
  ListArticlesInput,
  ListArticlesResult,
  CreateArticleInput,
  CreateArticleResult,
  UpdateArticleInput,
  UpdateArticleResult,
  RequestArticleRevisionInput,
  RequestArticleRevisionResult,
  ApproveArticleInput,
  ApproveArticleResult,
  RejectArticleInput,
  RejectArticleResult,
  LookupOption,
} from "../types";

import { HttpError } from "../../server/helpers";

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function mapArticleRecord(article: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  reviewer_id: string | null;
  publication_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  submitted_at: Date | string | null;
  revision_requested_at: Date | string | null;
  approved_at: Date | string | null;
  rejected_at: Date | string | null;
  reviewer_notes: string | null;
  category: string | null;
}): GetArticleResult {
  return {
    id: article.id,
    title: article.title,
    description: article.description ?? undefined,
    status: article.status as GetArticleResult["status"],
    reviewer_id: article.reviewer_id ?? undefined,
    publication_id: article.publication_id,
    created_at: iso(article.created_at)!,
    updated_at: iso(article.updated_at)!,
    submitted_at: iso(article.submitted_at),
    revision_requested_at: iso(article.revision_requested_at),
    approved_at: iso(article.approved_at),
    rejected_at: iso(article.rejected_at),
    reviewer_notes: article.reviewer_notes ?? undefined,
    category: article.category ?? undefined
  };
}

export class PrismaArticleRepository implements ArticleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listPublicationOptions(): Promise<LookupOption[]> {
    const publications = await this.prisma.publication.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ name: "asc" }]
    });
    return publications.map((publication) => ({ value: publication.id, label: publication.name }));
  }

  async listUserOptions(): Promise<LookupOption[]> {
    const users = await this.prisma.user.findMany({
      where: { is_active: true },
      orderBy: [{ display_name: "asc" }]
    });
    return users.map((user) => ({ value: user.id, label: user.display_name }));
  }

  async getArticle(input: GetArticleInput): Promise<GetArticleResult> {
    const article = await this.prisma.article.findUnique({ where: { id: input.article_id } });
    if (!article) throw new HttpError(404, "cap_get_article_not_found", "Article not found");
    return mapArticleRecord(article);
  }

  async listArticles(input: ListArticlesInput): Promise<ListArticlesResult> {
    const take = Math.min(input.limit ?? 25, 100);
    const articles = await this.prisma.article.findMany({
      where: {
        publication_id: input.publication_id ?? undefined,
        reviewer_id: input.reviewer_id ?? undefined,
        status: input.status ?? undefined,
        ...(input.after ? { created_at: { lt: new Date(input.after) } } : {})
      },
      orderBy: [{ created_at: "desc" }],
      take: take + 1
    });
    const page = articles.slice(0, take).map(mapArticleRecord);
    return { items: page, next_cursor: page.length > 0 ? page[page.length - 1]!.created_at : "" };
  }

  async createArticle(input: CreateArticleInput): Promise<CreateArticleResult> {
    const publication = await this.prisma.publication.findUnique({ where: { id: input.publication_id } });
    if (!publication) throw new HttpError(400, "cap_create_article_invalid_request", "Publication does not exist");
    if (publication.status === "archived") throw new HttpError(409, "rule_no_article_creation_in_archived_publication", "Cannot create articles in archived publications");
    if (input.reviewer_id) {
      const reviewer = await this.prisma.user.findUnique({ where: { id: input.reviewer_id } });
      if (!reviewer || !reviewer.is_active) throw new HttpError(400, "rule_only_active_users_may_review_articles", "Article reviewer must be active");
    }
    const now = new Date();
    const article = await this.prisma.article.create({
      data: {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description ?? null,
        status: input.reviewer_id ? "submitted" : "draft",
        reviewer_id: input.reviewer_id ?? null,
        publication_id: input.publication_id,
        created_at: now,
        updated_at: now,
        submitted_at: input.reviewer_id ? now : null,
        revision_requested_at: null,
        approved_at: null,
        rejected_at: null,
        reviewer_notes: null,
        category: input.category ?? null
      }
    });
    return mapArticleRecord(article);
  }

  async updateArticle(input: UpdateArticleInput): Promise<UpdateArticleResult> {
    if (input.reviewer_id) {
      const reviewer = await this.prisma.user.findUnique({ where: { id: input.reviewer_id } });
      if (!reviewer || !reviewer.is_active) throw new HttpError(400, "rule_only_active_users_may_review_articles", "Article reviewer must be active");
    }
    const article = await this.prisma.article.update({
      where: { id: input.article_id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.reviewer_id !== undefined ? { reviewer_id: input.reviewer_id ?? null } : {}),
        ...(input.category !== undefined ? { category: input.category ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === "submitted" ? { submitted_at: new Date(), revision_requested_at: null, approved_at: null, rejected_at: null } : {}),
        updated_at: new Date()
      }
    }).catch((error) => {
      throw new HttpError(404, "cap_get_article_not_found", error instanceof Error ? error.message : "Article not found");
    });
    return mapArticleRecord(article);
  }


  async requestArticleRevision(input: RequestArticleRevisionInput): Promise<RequestArticleRevisionResult> {
    const reviewerNotes = input.reviewer_notes?.trim();
    if (!reviewerNotes) throw new HttpError(400, "cap_request_article_revision_invalid_request", "Reviewer notes are required to request revisions");
    const requestedAt = input.revision_requested_at ? new Date(input.revision_requested_at) : new Date();
    const article = await this.prisma.article.update({
      where: { id: input.article_id },
      data: { status: "needs_revision", revision_requested_at: requestedAt, approved_at: null, rejected_at: null, reviewer_notes: reviewerNotes, updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "cap_get_article_not_found", error instanceof Error ? error.message : "Article not found");
    });
    return mapArticleRecord(article);
  }

  async approveArticle(input: ApproveArticleInput): Promise<ApproveArticleResult> {
    const approvedAt = input.approved_at ? new Date(input.approved_at) : new Date();
    const article = await this.prisma.article.update({
      where: { id: input.article_id },
      data: { status: "approved", revision_requested_at: null, approved_at: approvedAt, rejected_at: null, reviewer_notes: input.reviewer_notes ?? null, updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "cap_get_article_not_found", error instanceof Error ? error.message : "Article not found");
    });
    return mapArticleRecord(article);
  }

  async rejectArticle(input: RejectArticleInput): Promise<RejectArticleResult> {
    const rejectedAt = input.rejected_at ? new Date(input.rejected_at) : new Date();
    const article = await this.prisma.article.update({
      where: { id: input.article_id },
      data: { status: "rejected", revision_requested_at: null, approved_at: null, rejected_at: rejectedAt, reviewer_notes: input.reviewer_notes ?? null, updated_at: new Date() }
    }).catch((error) => {
      throw new HttpError(404, "cap_get_article_not_found", error instanceof Error ? error.message : "Article not found");
    });
    return mapArticleRecord(article);
  }
}
