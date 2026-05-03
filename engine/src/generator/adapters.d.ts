export const BUNDLED_GENERATOR_ADAPTERS: any[];
export function getBundledGeneratorAdapter(generatorId: string): any;
export function resolveGeneratorForComponent(component: any): { manifest: any; adapter: any };
export function generateWithComponentGenerator(context: any): { files: Record<string, string>; artifacts?: any; diagnostics?: any[] };
