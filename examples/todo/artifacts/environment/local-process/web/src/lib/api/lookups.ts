import { PUBLIC_TOPOGRAM_API_BASE_URL } from "$env/static/public";

export interface LookupOption {
  value: string;
  label: string;
}

function apiBase() {
  return PUBLIC_TOPOGRAM_API_BASE_URL || "http://localhost:3000";
}

export async function listLookupOptions(fetcher: typeof fetch, route: string): Promise<LookupOption[]> {
  const response = await fetcher(new URL(route, apiBase()).toString());
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Lookup request failed (${response.status}): ${detail}`);
  }
  return response.json();
}
