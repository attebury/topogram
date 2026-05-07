import type {
  CompleteItemInput,
  CompleteItemResult,
  CreateCollectionInput,
  CreateCollectionResult,
  CreateItemInput,
  CreateItemResult,
  CreateMemberInput,
  CreateMemberResult,
  DeleteItemInput,
  DeleteItemResult,
  DownloadItemExportInput,
  DownloadItemExportResult,
  ExportItemsInput,
  ExportItemsResult,
  GetCollectionInput,
  GetCollectionResult,
  GetItemExportJobInput,
  GetItemExportJobResult,
  GetItemInput,
  GetItemResult,
  GetMemberInput,
  GetMemberResult,
  ListCollectionsInput,
  ListCollectionsResult,
  ListItemsInput,
  ListItemsResult,
  ListMembersInput,
  ListMembersResult,
  LookupOption,
  MarkExportJobCompletedInput,
  MarkExportJobCompletedResult,
  UpdateCollectionInput,
  UpdateCollectionResult,
  UpdateItemInput,
  UpdateItemResult,
  UpdateMemberInput,
  UpdateMemberResult,
} from "./types";

export interface AppBasicRepository {
  getCollection(input: GetCollectionInput): Promise<GetCollectionResult>;
  listCollections(input: ListCollectionsInput): Promise<ListCollectionsResult>;
  createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult>;
  updateCollection(input: UpdateCollectionInput): Promise<UpdateCollectionResult>;
  getMember(input: GetMemberInput): Promise<GetMemberResult>;
  listMembers(input: ListMembersInput): Promise<ListMembersResult>;
  createMember(input: CreateMemberInput): Promise<CreateMemberResult>;
  updateMember(input: UpdateMemberInput): Promise<UpdateMemberResult>;
  getItem(input: GetItemInput): Promise<GetItemResult>;
  listItems(input: ListItemsInput): Promise<ListItemsResult>;
  createItem(input: CreateItemInput): Promise<CreateItemResult>;
  updateItem(input: UpdateItemInput): Promise<UpdateItemResult>;
  completeItem(input: CompleteItemInput): Promise<CompleteItemResult>;
  deleteItem(input: DeleteItemInput): Promise<DeleteItemResult>;
  exportItems(input: ExportItemsInput): Promise<ExportItemsResult>;
  getItemExportJob(input: GetItemExportJobInput): Promise<GetItemExportJobResult>;
  listCollectionOptions(): Promise<LookupOption[]>;
  listMemberOptions(): Promise<LookupOption[]>;
  downloadItemExport(input: DownloadItemExportInput): Promise<DownloadItemExportResult>;
  markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult>;
}
