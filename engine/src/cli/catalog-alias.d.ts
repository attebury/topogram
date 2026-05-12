export function resolveCatalogTemplateAlias(templateName: string, catalogSource?: string | null): any;
export function formatCatalogTemplateAliasError(templateName: string, catalogSource: string | null, error: unknown, options?: { suggestions?: string[] }): string;
export function suggestCatalogTemplateIds(catalog: any, templateName: string): string[];
