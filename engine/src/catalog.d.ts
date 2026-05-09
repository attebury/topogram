export function catalogEntryPackageSpec(entry: any, version?: string | null): string;
export function catalogSourceOrDefault(source?: string | null): string;
export function catalogTemplateListItem(entry: any): any;
export function findCatalogEntry(catalog: any, id: string, kind?: "template" | "topogram" | null): any | null;
export function isCatalogSourceDisabled(source: string | null | undefined): boolean;
export function loadCatalog(sourceInput?: string | null): any;
