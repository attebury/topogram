import { env as publicEnv } from "$env/dynamic/public";

export interface LookupOption {
  value: string;
  label: string;
}

function apiBase() {
  return publicEnv.PUBLIC_TOPOGRAM_API_BASE_URL || "http://localhost:3000";
}

function authToken() {
  return publicEnv.PUBLIC_TOPOGRAM_AUTH_TOKEN || "";
}

export async function listLookupOptions(fetcher: typeof fetch, route: string): Promise<LookupOption[]> {
  const headers = new Headers();
  if (authToken()) {
    headers.set("Authorization", "Bearer " + authToken());
  }
  const response = await fetcher(new URL(route, apiBase()).toString(), { headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Lookup request failed (${response.status}): ${detail}`);
  }
  return response.json();
}
