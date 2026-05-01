const endpoints = [
  {
    "label": "api health",
    "url": "http://localhost:3000/health",
    "expectJson": "ok"
  },
  {
    "label": "api readiness",
    "url": "http://localhost:3000/ready",
    "expectJson": "ready"
  },
  {
    "label": "web app",
    "url": "http://localhost:5173/tasks"
  }
];
const timeoutMs = Number(process.env.TOPOGRAM_RUNTIME_WAIT_MS || "60000");
const intervalMs = Number(process.env.TOPOGRAM_RUNTIME_WAIT_INTERVAL_MS || "500");
const startedAt = Date.now();

function envUrl(url) {
  return String(url)
    .replace("http://localhost:3000", process.env.TOPOGRAM_API_BASE_URL || process.env.PUBLIC_TOPOGRAM_API_BASE_URL || "http://localhost:3000")
    .replace("http://localhost:5173", process.env.TOPOGRAM_WEB_BASE_URL || process.env.PUBLIC_TOPOGRAM_WEB_BASE_URL || `http://localhost:${process.env.WEB_PORT || "5173"}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isReady(endpoint) {
  const url = envUrl(endpoint.url);
  try {
    const response = await fetch(url);
    if (response.status !== 200) {
      return { ok: false, message: `${endpoint.label} returned ${response.status}` };
    }
    if (endpoint.expectJson) {
      const body = await response.json().catch(() => null);
      if (body?.[endpoint.expectJson] !== true) {
        return { ok: false, message: `${endpoint.label} did not report ${endpoint.expectJson}=true` };
      }
    }
    return { ok: true };
  } catch (error) {
    const code = error?.cause?.code || error?.code || (error instanceof Error ? error.message : String(error));
    return { ok: false, message: `${endpoint.label} not reachable: ${code}` };
  }
}

if (endpoints.length === 0) {
  console.log("No runtime endpoints are configured; skipping readiness wait.");
  process.exit(0);
}

let lastMessage = "";
while (Date.now() - startedAt < timeoutMs) {
  const results = await Promise.all(endpoints.map((endpoint) => isReady(endpoint)));
  if (results.every((result) => result.ok)) {
    console.log("Generated stack is ready.");
    process.exit(0);
  }
  lastMessage = results.filter((result) => !result.ok).map((result) => result.message).join("; ");
  await sleep(intervalMs);
}

console.error(`Generated stack did not become ready within ${timeoutMs}ms. ${lastMessage}`);
process.exit(1);
