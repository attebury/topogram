export interface LookupOption {
  value: string;
  label: string;
}

function apiBase() {
  return import.meta.env.PUBLIC_TOPOGRAM_API_BASE_URL || import.meta.env.VITE_PUBLIC_TOPOGRAM_API_BASE_URL || "http://localhost:3002";
}

function authToken() {
  return import.meta.env.PUBLIC_TOPOGRAM_AUTH_TOKEN || import.meta.env.VITE_PUBLIC_TOPOGRAM_AUTH_TOKEN || "";
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
