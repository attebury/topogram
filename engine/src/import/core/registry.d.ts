export const extractorRegistry: Record<string, any[]>;
export const enricherRegistry: Record<string, any[]>;
export const BUILTIN_EXTRACTOR_PACKS: any[];
export function getExtractorsForTrack(...args: any[]): any[];
export function getEnrichersForTrack(...args: any[]): any[];
export function getBundledExtractorPack(...args: any[]): any;
export function getBundledExtractorById(...args: any[]): any;
