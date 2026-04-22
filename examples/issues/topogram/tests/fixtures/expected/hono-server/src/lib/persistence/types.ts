export interface GetIssueInput {
  issue_id: string;
}

export interface GetIssueResult {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed" | "archived";
  assignee_id?: string;
  board_id: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  priority?: string;
}

export interface ListIssuesInput {
  board_id?: string;
  assignee_id?: string;
  status?: "open" | "in_progress" | "closed" | "archived";
  after?: string;
  limit?: number;
}

export interface ListIssuesResultItem {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed" | "archived";
  assignee_id?: string;
  board_id: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  priority?: string;
}

export interface ListIssuesResult {
  items: ListIssuesResultItem[];
  next_cursor: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  assignee_id?: string;
  board_id: string;
  priority?: string;
}

export interface CreateIssueResult {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed" | "archived";
  assignee_id?: string;
  board_id: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  priority?: string;
}

export interface UpdateIssueInput {
  issue_id: string;
  title?: string;
  description?: string;
  assignee_id?: string;
  priority?: string;
  status?: "open" | "in_progress" | "closed" | "archived";
}

export interface UpdateIssueResult {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed" | "archived";
  assignee_id?: string;
  board_id: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  priority?: string;
}

export interface CloseIssueInput {
  issue_id: string;
  closed_at?: string;
}

export interface CloseIssueResult {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed" | "archived";
  assignee_id?: string;
  board_id: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  priority?: string;
}

export interface LookupOption {
  value: string;
  label: string;
}
