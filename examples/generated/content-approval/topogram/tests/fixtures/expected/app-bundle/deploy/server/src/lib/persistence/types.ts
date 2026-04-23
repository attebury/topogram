export interface GetArticleInput {
  article_id: string;
}

export interface GetArticleResult {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface ListArticlesInput {
  publication_id?: string;
  reviewer_id?: string;
  status?: "draft" | "submitted" | "needs_revision" | "approved" | "rejected";
  after?: string;
  limit?: number;
}

export interface ListArticlesResultItem {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface ListArticlesResult {
  items: ListArticlesResultItem[];
  next_cursor: string;
}

export interface CreateArticleInput {
  title: string;
  description?: string;
  reviewer_id?: string;
  publication_id: string;
  category?: string;
}

export interface CreateArticleResult {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface UpdateArticleInput {
  article_id: string;
  title?: string;
  description?: string;
  reviewer_id?: string;
  category?: string;
  status?: "draft" | "submitted" | "needs_revision" | "approved" | "rejected";
}

export interface UpdateArticleResult {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface RequestArticleRevisionInput {
  article_id: string;
  revision_requested_at?: string;
  reviewer_notes: string;
}

export interface RequestArticleRevisionResult {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface ApproveArticleInput {
  article_id: string;
  approved_at?: string;
  reviewer_notes?: string;
}

export interface ApproveArticleResult {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface RejectArticleInput {
  article_id: string;
  rejected_at?: string;
  reviewer_notes?: string;
}

export interface RejectArticleResult {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  reviewer_id?: string;
  publication_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  revision_requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
  reviewer_notes?: string;
  category?: string;
}

export interface LookupOption {
  value: string;
  label: string;
}
