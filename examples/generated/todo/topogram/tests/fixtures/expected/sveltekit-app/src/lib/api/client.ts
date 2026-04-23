import { PUBLIC_TOPOGRAM_API_BASE_URL } from "$env/static/public";
import apiContracts from "$lib/topogram/api-contracts.json";

type Fetcher = typeof fetch;
type ApiContract = (typeof apiContracts)[keyof typeof apiContracts];
type RequestOptions = {
  headers?: Record<string, string>;
};

function apiBase() {
  return PUBLIC_TOPOGRAM_API_BASE_URL || "http://localhost:3000";
}

function buildPath(contract: ApiContract, input: Record<string, unknown>) {
  let path = contract.endpoint.path;
  for (const field of contract.requestContract?.transport.path || []) {
    const raw = input[field.name];
    path = path.replace(`:${field.transport.wireName}`, encodeURIComponent(String(raw ?? "")));
  }
  const params = new URLSearchParams();
  for (const field of contract.requestContract?.transport.query || []) {
    const raw = input[field.name];
    if (raw !== undefined && raw !== null && raw !== "") {
      params.set(field.transport.wireName, String(raw));
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function request(fetcher: Fetcher, capabilityId: keyof typeof apiContracts, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  const contract = apiContracts[capabilityId];
  const url = new URL(buildPath(contract, input), apiBase()).toString();
  const headers = new Headers();
  for (const [name, value] of Object.entries(options.headers || {})) {
    headers.set(name, value);
  }
  let body: string | undefined;
  if ((contract.requestContract?.transport.body || []).length > 0) {
    headers.set("content-type", "application/json");
    const payload: Record<string, unknown> = {};
    for (const field of contract.requestContract?.transport.body || []) {
      if (input[field.name] !== undefined) {
        payload[field.transport.wireName] = input[field.name];
      }
    }
    body = JSON.stringify(payload);
  }
  const response = await fetcher(url, { method: contract.endpoint.method, headers, body });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`${contract.endpoint.method} ${contract.endpoint.path} failed (${response.status}): ${detail}`) as Error & { status?: number; detail?: string };
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  if ((contract.endpoint.download || []).length > 0) {
    return response.arrayBuffer();
  }
  return response.json();
}

export async function listTasks(fetcher: Fetcher, input: Record<string, unknown> = {}) {
  return request(fetcher, "cap_list_tasks", input);
}

export async function getTask(fetcher: Fetcher, task_id: string) {
  return request(fetcher, "cap_get_task", { task_id });
}

export async function createTask(fetcher: Fetcher, input: Record<string, unknown>, options: RequestOptions = {}) {
  return request(fetcher, "cap_create_task", input, options);
}

export async function updateTask(fetcher: Fetcher, task_id: string, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return request(fetcher, "cap_update_task", { task_id, ...input }, options);
}

export async function completeTask(fetcher: Fetcher, task_id: string, input: Record<string, unknown> = {}, options: RequestOptions = {}) {
  return request(fetcher, "cap_complete_task", { task_id, ...input }, options);
}

export async function deleteTask(fetcher: Fetcher, task_id: string, options: RequestOptions = {}) {
  return request(fetcher, "cap_delete_task", { task_id }, options);
}

export async function exportTasks(fetcher: Fetcher, input: Record<string, unknown> = {}) {
  return request(fetcher, "cap_export_tasks", input);
}

export async function getTaskExportJob(fetcher: Fetcher, job_id: string) {
  return request(fetcher, "cap_get_task_export_job", { job_id });
}
