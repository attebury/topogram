import type {
  CloseIssueInput,
  CloseIssueResult,
  CreateIssueInput,
  CreateIssueResult,
  GetIssueInput,
  GetIssueResult,
  ListIssuesInput,
  ListIssuesResult,
  LookupOption,
  UpdateIssueInput,
  UpdateIssueResult,
} from "./types";

export interface IssueRepository {
  getIssue(input: GetIssueInput): Promise<GetIssueResult>;
  listIssues(input: ListIssuesInput): Promise<ListIssuesResult>;
  createIssue(input: CreateIssueInput): Promise<CreateIssueResult>;
  updateIssue(input: UpdateIssueInput): Promise<UpdateIssueResult>;
  closeIssue(input: CloseIssueInput): Promise<CloseIssueResult>;
  listBoardOptions(): Promise<LookupOption[]>;
  listUserOptions(): Promise<LookupOption[]>;
}
