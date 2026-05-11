export const IMPORT_TRACKS = new Set(["db", "api", "ui", "cli", "workflows", "verification"]);

/**
 * @typedef {{score:number, reasons:string[]}} DetectionResult
 * @typedef {{findings:any[], candidates:any}} ExtractResult
 * @typedef {{
 *   id:string,
 *   track:"db"|"api"|"ui"|"cli"|"workflows"|"verification",
 *   detect:(context:any)=>DetectionResult,
 *   extract:(context:any)=>ExtractResult
 * }} ImportExtractor
 * @typedef {{
 *   id:string,
 *   track:"db"|"api"|"ui"|"cli"|"workflows"|"verification"|"docs",
 *   applies:(context:any, candidates:any)=>boolean|number,
 *   enrich:(context:any, candidates:any)=>any
 * }} ImportEnricher
 * @typedef {{
 *   paths:any,
 *   helpers:any,
 *   options:any
 * }} ImportContext
 */
