export const canonicalCandidateTerm: (value: unknown, options?: { technicalStopwords?: boolean }) => string;
export const ensureTrailingNewline: (value: string) => string;
export const extractRankedTerms: (markdown: string, options?: { technicalStopwords?: boolean }) => string[];
export const idHintify: (value: unknown) => string;
export const pluralizeCandidateTerm: (value: unknown) => string;
export const slugify: (value: unknown) => string;
export const titleCase: (value: unknown) => string;
