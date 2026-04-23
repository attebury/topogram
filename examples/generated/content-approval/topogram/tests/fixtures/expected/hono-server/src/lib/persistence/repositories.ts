import type {
  ApproveArticleInput,
  ApproveArticleResult,
  CreateArticleInput,
  CreateArticleResult,
  GetArticleInput,
  GetArticleResult,
  ListArticlesInput,
  ListArticlesResult,
  LookupOption,
  RejectArticleInput,
  RejectArticleResult,
  RequestArticleRevisionInput,
  RequestArticleRevisionResult,
  UpdateArticleInput,
  UpdateArticleResult,
} from "./types";

export interface ArticleRepository {
  getArticle(input: GetArticleInput): Promise<GetArticleResult>;
  listArticles(input: ListArticlesInput): Promise<ListArticlesResult>;
  createArticle(input: CreateArticleInput): Promise<CreateArticleResult>;
  updateArticle(input: UpdateArticleInput): Promise<UpdateArticleResult>;
  requestArticleRevision(input: RequestArticleRevisionInput): Promise<RequestArticleRevisionResult>;
  approveArticle(input: ApproveArticleInput): Promise<ApproveArticleResult>;
  rejectArticle(input: RejectArticleInput): Promise<RejectArticleResult>;
  listPublicationOptions(): Promise<LookupOption[]>;
  listUserOptions(): Promise<LookupOption[]>;
}
